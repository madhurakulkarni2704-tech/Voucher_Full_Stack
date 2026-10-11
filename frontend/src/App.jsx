import { useEffect, useState } from "react";
import { apiRequest } from "./api";
import Vouchers from "./Vouchers";
import Director from "./Director";
import Accounts from "./Accounts";
import "./App.css";

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("voucherflow_user"));
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() =>
    localStorage.getItem("voucherflow_token")
  );

  const [page, setPage] = useState("dashboard");
  const [voucherFilter, setVoucherFilter] = useState("All");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("Employee");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");

  const [recentVouchers, setRecentVouchers] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState("");

  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  // Director recent activity state.
  const [directorRecentActivity, setDirectorRecentActivity] = useState([]);
  const [directorActivityLoading, setDirectorActivityLoading] =
    useState(false);
  const [directorActivityError, setDirectorActivityError] = useState("");

  // Load dashboard statistics for the logged-in role.
  useEffect(() => {
    if (!user || !token) {
      setSummary(null);
      setSummaryError("");
      return;
    }

    let cancelled = false;

    const fetchSummary = async () => {
      try {
        setSummaryError("");
        setSummary(null);

        const endpoint =
          user.role === "Employee"
            ? "/vouchers/dashboard-summary"
            : user.role === "Director"
              ? "/director/dashboard-summary"
              : user.role === "Accounts"
                ? "/accounts/dashboard-summary"
                : null;

        if (!endpoint) {
          setSummaryError("No dashboard is available for this role.");
          return;
        }

        const response = await apiRequest(endpoint);

        if (!cancelled) {
          setSummary(response.summary || null);
        }
      } catch (error) {
        if (!cancelled) {
          setSummaryError(
            error.message || "Unable to load dashboard statistics."
          );
        }
      }
    };

    fetchSummary();

    return () => {
      cancelled = true;
    };
  }, [user, token]);

  // Load recent vouchers for the Employee dashboard.
  useEffect(() => {
    if (!user || !token || user.role !== "Employee" || page !== "dashboard") {
      return;
    }

    let cancelled = false;

    const fetchRecentVouchers = async () => {
      setRecentLoading(true);
      setRecentError("");

      try {
        const response = await apiRequest("/vouchers/my");

        if (!cancelled) {
          const vouchers =
            response.vouchers ||
            response.data?.vouchers ||
            (Array.isArray(response.data) ? response.data : []);

          const sortedVouchers = [...vouchers].sort((a, b) => {
            const dateA = new Date(
              a.updated_at || a.created_at || a.voucher_date || 0
            ).getTime();

            const dateB = new Date(
              b.updated_at || b.created_at || b.voucher_date || 0
            ).getTime();

            return dateB - dateA;
          });

          setRecentVouchers(sortedVouchers.slice(0, 5));
        }
      } catch (error) {
        if (!cancelled) {
          setRecentError(
            error.message || "Unable to load recent vouchers."
          );
        }
      } finally {
        if (!cancelled) {
          setRecentLoading(false);
        }
      }
    };

    fetchRecentVouchers();

    return () => {
      cancelled = true;
    };
  }, [user, token, page]);

  // Load recent activity for the Employee's vouchers.
  useEffect(() => {
    if (!user || !token || user.role !== "Employee" || page !== "dashboard") {
      return;
    }

    let cancelled = false;

    const fetchRecentActivity = async () => {
      setActivityLoading(true);
      setActivityError("");

      try {
        const voucherResponse = await apiRequest("/vouchers/my");

        const vouchers =
          voucherResponse.vouchers ||
          voucherResponse.data?.vouchers ||
          (Array.isArray(voucherResponse.data)
            ? voucherResponse.data
            : []);

        const activityResponses = await Promise.all(
          vouchers.map(async (voucher) => {
            try {
              const response = await apiRequest(
                `/vouchers/my/${voucher.voucher_id}/activity`
              );

              return (response.activities || []).map((activity) => ({
                ...activity,
                voucher_id: voucher.voucher_id,
                voucher_number:
                  voucher.voucher_number ||
                  `Voucher #${voucher.voucher_id}`,
                voucher_title:
                  voucher.title || voucher.category || "Expense",
              }));
            } catch {
              return [];
            }
          })
        );

        if (!cancelled) {
          const allActivities = activityResponses
            .flat()
            .sort(
              (a, b) =>
                new Date(b.created_at || 0).getTime() -
                new Date(a.created_at || 0).getTime()
            );

          setRecentActivity(allActivities.slice(0, 5));
        }
      } catch (error) {
        if (!cancelled) {
          setActivityError(
            error.message || "Unable to load recent activity."
          );
        }
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    };

    fetchRecentActivity();

    return () => {
      cancelled = true;
    };
  }, [user, token, page]);

  // Load recent activity across all vouchers for the Director.
  useEffect(() => {
    if (!user || !token || user.role !== "Director" || page !== "dashboard") {
      return;
    }

    let cancelled = false;

    const fetchDirectorRecentActivity = async () => {
      setDirectorActivityLoading(true);
      setDirectorActivityError("");

      try {
        const response = await apiRequest("/director/recent-activity");

        if (!cancelled) {
          setDirectorRecentActivity(
            Array.isArray(response.activities) ? response.activities : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setDirectorActivityError(
            error.message || "Unable to load Director recent activity."
          );
        }
      } finally {
        if (!cancelled) {
          setDirectorActivityLoading(false);
        }
      }
    };

    fetchDirectorRecentActivity();

    return () => {
      cancelled = true;
    };
  }, [user, token, page]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginError("");
    setLoading(true);

    try {
      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (response.user.role !== selectedRole) {
        setLoginError(
          `This account has the role "${response.user.role}". Please select the correct role.`
        );
        return;
      }

      localStorage.setItem("voucherflow_token", response.token);
      localStorage.setItem("voucherflow_user", JSON.stringify(response.user));

      setToken(response.token);
      setUser(response.user);
      setPage("dashboard");
      setVoucherFilter("All");
      setPassword("");
    } catch (error) {
      setLoginError(
        error.message || "Login failed. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("voucherflow_token");
    localStorage.removeItem("voucherflow_user");

    setToken(null);
    setUser(null);
    setSummary(null);
    setSummaryError("");
    setRecentVouchers([]);
    setRecentError("");
    setRecentActivity([]);
    setActivityError("");
    setDirectorRecentActivity([]);
    setDirectorActivityError("");
    setPage("dashboard");
    setVoucherFilter("All");
    setEmail("");
    setPassword("");
    setLoginError("");
  };

  const openVouchers = (filter = "All") => {
    setVoucherFilter(filter);
    setPage("vouchers");
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatAmount = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const getStatusClass = (status) => {
    switch (status) {
      case "Approved":
        return "status-approved";
      case "Rejected":
        return "status-rejected";
      case "Pending Approval":
        return "status-pending";
      case "Draft":
        return "status-draft";
      default:
        return "";
    }
  };

  const employeeCards = [
    {
      title: "Total Vouchers",
      value: summary?.total_vouchers ?? 0,
      description: "All vouchers created by you.",
      icon: "▤",
    },
    {
      title: "Draft Vouchers",
      value: summary?.draft_vouchers ?? 0,
      description: "Vouchers saved but not submitted.",
      icon: "✎",
    },
    {
      title: "Pending Approval",
      value: summary?.pending_vouchers ?? 0,
      description: "Vouchers awaiting review.",
      icon: "◷",
    },
    {
      title: "Approved Vouchers",
      value: summary?.approved_vouchers ?? 0,
      description: "Vouchers approved by the Director.",
      icon: "✓",
    },
    {
      title: "Rejected Vouchers",
      value: summary?.rejected_vouchers ?? 0,
      description: "Vouchers requiring your attention.",
      icon: "×",
    },
  ];

  const directorCards = [
    {
      title: "Pending Approvals",
      value: summary?.pending_vouchers ?? 0,
      description: "Vouchers waiting for your review.",
      icon: "◷",
    },
    {
      title: "Approved Today",
      value: summary?.approved_today ?? 0,
      description: "Vouchers approved today.",
      icon: "✓",
    },
    {
      title: "Rejected Today",
      value: summary?.rejected_today ?? 0,
      description: "Vouchers rejected today.",
      icon: "×",
    },
    {
      title: "Total Pending Amount",
      value: `₹${formatAmount(summary?.total_pending_amount ?? 0)}`,
      description: "Total expenses awaiting approval.",
      icon: "₹",
    },
  ];

  const accountsCards = [
    {
      title: "Total Vouchers",
      value: summary?.total_vouchers ?? 0,
      description: "All vouchers in the system.",
      icon: "▤",
    },
    {
      title: "Pending Approval",
      value: summary?.pending_vouchers ?? 0,
      description: "Vouchers awaiting review.",
      icon: "◷",
    },
    {
      title: "Approved Vouchers",
      value: summary?.approved_vouchers ?? 0,
      description: "Approved expense vouchers.",
      icon: "✓",
    },
    {
      title: "Rejected Vouchers",
      value: summary?.rejected_vouchers ?? 0,
      description: "Rejected expense vouchers.",
      icon: "×",
    },
  ];

  if (!user || !token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-icon">V</div>
            <div>
              <h1>VoucherFlow</h1>
              <p>Expense Management</p>
            </div>
          </div>

          <div className="login-heading">
            <p className="dashboard-eyebrow">WELCOME BACK</p>
            <h2>Sign in to your workspace</h2>
            <p className="login-description">
              Manage expense vouchers and track approvals in one place.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <label htmlFor="role">Login as</label>
            <select
              id="role"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
            >
              <option value="Employee">Employee</option>
              <option value="Director">Director</option>
              <option value="Accounts">Accounts</option>
            </select>

            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />

            {loginError && <p className="login-error">{loginError}</p>}

            <button
              className="primary-button login-button"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="login-footer">
            Secure expense management for your organization.
          </p>
        </div>
      </div>
    );
  }

  const isEmployee = user.role === "Employee";
  const isDirector = user.role === "Director";
  const isAccounts = user.role === "Accounts";

  const displayName = user.full_name || user.username || "User";
  const firstName = displayName.split(" ")[0];

  const cards = isEmployee
    ? employeeCards
    : isDirector
      ? directorCards
      : isAccounts
        ? accountsCards
        : [];

  const pageTitle =
    page === "vouchers"
      ? "My Vouchers"
      : page === "pending"
        ? "Pending Vouchers"
        : page === "accounts"
          ? "All Vouchers"
          : "Dashboard";

  const goToPage = (nextPage) => setPage(nextPage);

  return (
    <div className="dashboard-app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">V</div>
          <div>
            <h2>VoucherFlow</h2>
            <p>Expense Management</p>
          </div>
        </div>

        <p className="sidebar-label">WORKSPACE</p>

        <button
          type="button"
          className={`sidebar-link ${page === "dashboard" ? "active" : ""}`}
          onClick={() => goToPage("dashboard")}
        >
          <span>▦</span> Dashboard
        </button>

        {isEmployee && (
          <button
            type="button"
            className={`sidebar-link ${page === "vouchers" ? "active" : ""}`}
            onClick={() => openVouchers("All")}
          >
            <span>▤</span> My Vouchers
          </button>
        )}

        {isDirector && (
          <button
            type="button"
            className={`sidebar-link ${page === "pending" ? "active" : ""}`}
            onClick={() => goToPage("pending")}
          >
            <span>◷</span> Pending Vouchers
          </button>
        )}

        {isAccounts && (
          <button
            type="button"
            className={`sidebar-link ${page === "accounts" ? "active" : ""}`}
            onClick={() => goToPage("accounts")}
          >
            <span>▤</span> All Vouchers
          </button>
        )}

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>✦</span>
            <h3>Stay organized</h3>
            <p>Keep every expense clear and accountable.</p>
            <span className="workspace-status">Workspace active</span>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">EXPENSE MANAGEMENT</p>
            <p className="breadcrumb">Workspace / {pageTitle}</p>
          </div>

          <div className="profile-area">
            <div className="profile-avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="profile-details">
              <strong>{displayName}</strong>
              <span>{user.role}</span>
            </div>
            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </header>

        {page === "vouchers" && isEmployee ? (
          <Vouchers initialStatusFilter={voucherFilter} />
        ) : page === "pending" && isDirector ? (
          <Director />
        ) : page === "accounts" && isAccounts ? (
          <Accounts />
        ) : (
          <div className="dashboard-content">
            <section className="dashboard-welcome">
              <div>
                <p className="dashboard-eyebrow">YOUR WORKSPACE</p>
                <h1>Welcome back, {firstName}</h1>
                <p>Manage expense vouchers and track approvals.</p>
              </div>
              <div className="welcome-decoration">✦</div>
            </section>

            <section className="overview-section">
              <div className="section-heading">
                <div>
                  <h2>
                    {isDirector ? "Director Overview" : "Your Overview"}
                  </h2>
                  <p>
                    {isDirector
                      ? "Monitor approvals and review expense requests."
                      : "Statistics from your workspace"}
                  </p>
                </div>
                <span className="overview-badge">{user.role} Workspace</span>
              </div>

              {summaryError && (
                <p className="login-error" role="alert">
                  {summaryError}
                </p>
              )}

              <div className="dashboard-card-grid">
                {cards.length > 0 ? (
                  cards.map((card) => (
                    <article className="dashboard-card" key={card.title}>
                      <div className="dashboard-card-icon">{card.icon}</div>
                      <h3>{card.title}</h3>
                      <p className="dashboard-card-value">{card.value}</p>
                      <p>{card.description}</p>
                      <div className="card-bottom">
                        <span>Live statistics</span>
                        <span>↗</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="dashboard-card">
                    <div className="dashboard-card-icon">✓</div>
                    <h3>Workspace</h3>
                    <p>Voucher review and management</p>
                    <p>Open the navigation menu to access your tools.</p>
                  </article>
                )}
              </div>

              {isDirector && (
                <div className="dashboard-info-panel">
                  <div className="section-heading">
                    <div>
                      <p className="dashboard-eyebrow">ACTION REQUIRED</p>
                      <h2>Review Expense Vouchers</h2>
                      <p>
                        Open submitted vouchers to review details and approve
                        or reject them.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="voucher-submit-button"
                    onClick={() => goToPage("pending")}
                  >
                    Open Pending Vouchers
                  </button>
                </div>
              )}
            </section>

            {/* Director Recent Activity */}
            {isDirector && (
              <section className="dashboard-info-panel recent-activity-panel">
                <div className="section-heading">
                  <div>
                    <p className="dashboard-eyebrow">SYSTEM AUDIT TRAIL</p>
                    <h2>Recent Activity</h2>
                    <p>
                      Latest actions recorded across all expense vouchers.
                    </p>
                  </div>
                  <span className="overview-badge">
                    {directorRecentActivity.length}{" "}
                    {directorRecentActivity.length === 1 ? "Event" : "Events"}
                  </span>
                </div>

                {directorActivityLoading ? (
                  <p>Loading recent activity...</p>
                ) : directorActivityError ? (
                  <p className="login-error" role="alert">
                    {directorActivityError}
                  </p>
                ) : directorRecentActivity.length === 0 ? (
                  <div className="voucher-empty-state">
                    <p>No recent activity is available.</p>
                  </div>
                ) : (
                  <ol className="voucher-activity-list">
                    {directorRecentActivity.map((activity, index) => (
                      <li
                        className="voucher-activity-item"
                        key={
                          activity.activity_id ??
                          `${activity.voucher_id}-${index}`
                        }
                      >
                        <span
                          className="voucher-activity-dot"
                          aria-hidden="true"
                        />

                        <div className="voucher-activity-card">
                          <div className="voucher-activity-card-heading">
                            <strong>{activity.action}</strong>
                            <span>{formatDateTime(activity.created_at)}</span>
                          </div>

                          <p>
                            {activity.details || "No additional details."}
                          </p>

                          <div className="voucher-activity-actor">
                            <span>{activity.actor_name || "System"}</span>
                            {activity.actor_role && (
                              <span className="voucher-activity-role">
                                {activity.actor_role}
                              </span>
                            )}
                          </div>

                          <div className="recent-activity-voucher">
                            <span>Employee:</span>{" "}
                            <strong>
                              {activity.employee_name || "Unknown"}
                            </strong>
                          </div>

                          <div className="recent-activity-voucher">
                            <span>Voucher:</span>{" "}
                            <strong>
                              {activity.voucher_number ||
                                `Voucher #${activity.voucher_id}`}
                            </strong>
                            <span className="recent-activity-title">
                              {activity.voucher_title || "Expense"}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}

            {/* Employee Quick Actions */}
            {isEmployee && (
              <section className="dashboard-info-panel quick-actions-panel">
                <div className="section-heading">
                  <div>
                    <p className="dashboard-eyebrow">SHORTCUTS</p>
                    <h2>Quick Actions</h2>
                    <p>Manage your expense vouchers in fewer clicks.</p>
                  </div>
                </div>

                <div className="quick-actions-grid">
                  <button
                    type="button"
                    className="quick-action-card"
                    onClick={() => openVouchers("All")}
                  >
                    <span className="quick-action-icon">＋</span>
                    <span className="quick-action-text">
                      <strong>Manage Vouchers</strong>
                      <small>Create, edit, or submit expense vouchers.</small>
                    </span>
                    <span className="quick-action-arrow">→</span>
                  </button>

                  <button
                    type="button"
                    className="quick-action-card"
                    onClick={() => openVouchers("All")}
                  >
                    <span className="quick-action-icon">▤</span>
                    <span className="quick-action-text">
                      <strong>View All Vouchers</strong>
                      <small>Review your voucher records and statuses.</small>
                    </span>
                    <span className="quick-action-arrow">→</span>
                  </button>

                  <button
                    type="button"
                    className="quick-action-card"
                    onClick={() => openVouchers("Pending Approval")}
                  >
                    <span className="quick-action-icon">◷</span>
                    <span className="quick-action-text">
                      <strong>Track Approvals</strong>
                      <small>Open vouchers awaiting Director approval.</small>
                    </span>
                    <span className="quick-action-arrow">→</span>
                  </button>
                </div>
              </section>
            )}

            {/* Employee Recent Vouchers */}
            {isEmployee && (
              <section className="dashboard-info-panel recent-vouchers-panel">
                <div className="section-heading recent-vouchers-heading">
                  <div>
                    <p className="dashboard-eyebrow">YOUR ACTIVITY</p>
                    <h2>Recent Vouchers</h2>
                    <p>Your five most recently updated expense vouchers.</p>
                  </div>

                  <button
                    type="button"
                    className="voucher-secondary-button"
                    onClick={() => openVouchers("All")}
                  >
                    View All
                  </button>
                </div>

                {recentLoading ? (
                  <p className="recent-vouchers-message">
                    Loading recent vouchers...
                  </p>
                ) : recentError ? (
                  <p className="login-error" role="alert">
                    {recentError}
                  </p>
                ) : recentVouchers.length === 0 ? (
                  <div className="voucher-empty-state">
                    <p>No vouchers yet.</p>
                    <p>Create your first expense voucher to see it here.</p>
                    <button
                      type="button"
                      className="voucher-submit-button"
                      onClick={() => openVouchers("All")}
                    >
                      Open My Vouchers
                    </button>
                  </div>
                ) : (
                  <div className="recent-vouchers-list">
                    {recentVouchers.map((voucher) => (
                      <article
                        className="recent-voucher-item"
                        key={voucher.voucher_id}
                      >
                        <div className="recent-voucher-main">
                          <div className="recent-voucher-icon">▤</div>
                          <div className="recent-voucher-info">
                            <strong>
                              {voucher.voucher_number ||
                                `Voucher #${voucher.voucher_id}`}
                            </strong>
                            <span>
                              {voucher.title || voucher.category || "Expense"}
                            </span>
                            <small>
                              {formatDate(
                                voucher.updated_at ||
                                  voucher.created_at ||
                                  voucher.voucher_date
                              )}
                            </small>
                          </div>
                        </div>

                        <div className="recent-voucher-meta">
                          <strong className="recent-voucher-amount">
                            ₹{formatAmount(voucher.amount)}
                          </strong>
                          <span
                            className={`voucher-status ${getStatusClass(
                              voucher.status
                            )}`}
                          >
                            {voucher.status || "Unknown"}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Employee Recent Activity */}
            {isEmployee && (
              <section className="dashboard-info-panel recent-activity-panel">
                <div className="section-heading">
                  <div>
                    <p className="dashboard-eyebrow">AUDIT TRAIL</p>
                    <h2>Recent Activity</h2>
                    <p>
                      The latest actions recorded for your expense vouchers.
                    </p>
                  </div>
                  <span className="overview-badge">
                    {recentActivity.length}{" "}
                    {recentActivity.length === 1 ? "Event" : "Events"}
                  </span>
                </div>

                {activityLoading ? (
                  <p>Loading recent activity...</p>
                ) : activityError ? (
                  <p className="login-error" role="alert">
                    {activityError}
                  </p>
                ) : recentActivity.length === 0 ? (
                  <div className="voucher-empty-state">
                    <p>No recent activity is available.</p>
                  </div>
                ) : (
                  <ol className="voucher-activity-list">
                    {recentActivity.map((activity, index) => (
                      <li
                        className="voucher-activity-item"
                        key={`${activity.activity_id}-${activity.voucher_id}-${index}`}
                      >
                        <span
                          className="voucher-activity-dot"
                          aria-hidden="true"
                        />

                        <div className="voucher-activity-card">
                          <div className="voucher-activity-card-heading">
                            <strong>{activity.action}</strong>
                            <span>{formatDateTime(activity.created_at)}</span>
                          </div>

                          <p>
                            {activity.details || "No additional details."}
                          </p>

                          <div className="voucher-activity-actor">
                            <span>{activity.actor_name || "System"}</span>
                            {activity.actor_role && (
                              <span className="voucher-activity-role">
                                {activity.actor_role}
                              </span>
                            )}
                          </div>

                          <div className="recent-activity-voucher">
                            <span>Voucher:</span>{" "}
                            <strong>{activity.voucher_number}</strong>
                            <span className="recent-activity-title">
                              {activity.voucher_title}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}

            {/* Accounts dashboard */}
            {isAccounts && (
              <section className="dashboard-info-panel">
                <h3>Accounts Overview</h3>
                <p>
                  Approved amount: ₹
                  {formatAmount(summary?.approved_amount ?? 0)}
                </p>
                <p>Use All Vouchers to search and inspect expense records.</p>
                <button
                  type="button"
                  className="voucher-secondary-button"
                  onClick={() => goToPage("accounts")}
                >
                  Open All Vouchers
                </button>
              </section>
            )}

            <section className="dashboard-info-panel">
              <div className="info-panel-icon">✧</div>
              <h3>Welcome to your workspace</h3>
              <p>
                Your voucher statistics are fetched from the backend. Use the
                navigation menu to open the tools available for your role.
              </p>
            </section>

            <footer className="dashboard-footer">
              © 2026 VoucherFlow Expense Voucher Management System
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;