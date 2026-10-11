
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api";
import "./App.css";

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createEmptyForm = () => ({
  voucher_date: today(),
  expense_date: today(),
  department: "",
  title: "",
  category: "",
  description: "",
  amount: "",
});

const CATEGORIES = [
  "Travel",
  "Office Supplies",
  "Food and Refreshments",
  "Accommodation",
  "Communication",
  "Software and Technology",
  "Training",
  "Other",
];

const STATUS_FILTERS = [
  "All",
  "Draft",
  "Pending Approval",
  "Approved",
  "Rejected",
];

function Vouchers({ initialStatusFilter = "All" }) {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(createEmptyForm);

  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [signatureFile, setSignatureFile] = useState(null);
  const [signatureVoucherId, setSignatureVoucherId] = useState(null);
  const [actionId, setActionId] = useState(null);

  // Search and status filters
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [searchTerm, setSearchTerm] = useState("");

  // Activity history state
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  // Update filters when a Dashboard shortcut changes the initial filter.
  useEffect(() => {
    setStatusFilter(
      STATUS_FILTERS.includes(initialStatusFilter)
        ? initialStatusFilter
        : "All"
    );
    setSearchTerm("");
  }, [initialStatusFilter]);

  const fetchVouchers = useCallback(async () => {
    try {
      setError("");
      const response = await apiRequest("/vouchers/my");

      const data =
        response.vouchers ||
        response.data?.vouchers ||
        (Array.isArray(response.data) ? response.data : []);

      setVouchers(data);
    } catch (err) {
      setError(err.message || "Unable to load your vouchers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  // Apply status and search filters without changing backend data.
  const filteredVouchers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return vouchers.filter((voucher) => {
      const matchesStatus =
        statusFilter === "All" || voucher.status === statusFilter;

      const matchesSearch =
        !search ||
        String(voucher.voucher_number || "")
          .toLowerCase()
          .includes(search) ||
        String(voucher.voucher_id || "").includes(search) ||
        String(voucher.title || "").toLowerCase().includes(search) ||
        String(voucher.category || "").toLowerCase().includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [vouchers, statusFilter, searchTerm]);

  const statusCounts = useMemo(() => {
    const counts = {
      All: vouchers.length,
      Draft: 0,
      "Pending Approval": 0,
      Approved: 0,
      Rejected: 0,
    };

    vouchers.forEach((voucher) => {
      if (Object.prototype.hasOwnProperty.call(counts, voucher.status)) {
        counts[voucher.status] += 1;
      }
    });

    return counts;
  }, [vouchers]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(createEmptyForm());
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = String(value).slice(0, 10);
    const parts = date.split("-");

    return parts.length === 3
      ? `${parts[2]}/${parts[1]}/${parts[0]}`
      : date;
  };

  const formatDateTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatAmount = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(Number(amount || 0));

  const getStatusClass = (status) => {
    switch (status) {
      case "Approved":
        return "status-approved";
      case "Rejected":
        return "status-rejected";
      case "Pending Approval":
        return "status-pending";
      default:
        return "status-draft";
    }
  };

  const openCreateForm = () => {
    clearMessages();
    setSelectedVoucher(null);
    setActivities([]);
    setEditingId(null);
    setForm(createEmptyForm());
    setShowForm(true);
  };

  const openEditForm = (voucher) => {
    if (voucher.status !== "Draft") {
      setError("Only draft vouchers can be edited.");
      return;
    }

    clearMessages();
    setSelectedVoucher(null);
    setActivities([]);
    setEditingId(voucher.voucher_id);

    setForm({
      voucher_date: String(voucher.voucher_date || today()).slice(0, 10),
      expense_date: String(voucher.expense_date || today()).slice(0, 10),
      department: voucher.department || "",
      title: voucher.title || "",
      category: voucher.category || "",
      description: voucher.description || "",
      amount: String(voucher.amount ?? ""),
    });

    setShowForm(true);
  };

  const handleSaveVoucher = async (event) => {
    event.preventDefault();
    clearMessages();

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (form.expense_date > form.voucher_date) {
      setError("Expense date cannot be later than voucher date.");
      return;
    }

    const payload = {
      voucher_date: form.voucher_date,
      expense_date: form.expense_date,
      department: form.department.trim(),
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      amount,
    };

    setSaving(true);

    try {
      if (editingId !== null) {
        await apiRequest(`/vouchers/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        setSuccess("Draft voucher updated successfully.");
      } else {
        await apiRequest("/vouchers", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setSuccess("Voucher created successfully.");
      }

      closeForm();
      setLoading(true);
      await fetchVouchers();
    } catch (err) {
      setError(err.message || "Unable to save the voucher.");
    } finally {
      setSaving(false);
    }
  };

  const handleViewDetails = async (voucher) => {
    clearMessages();
    setDetailsLoading(true);
    setActivityLoading(true);
    setActivityError("");
    setActivities([]);
    setSelectedVoucher(voucher);

    try {
      const response = await apiRequest(
        `/vouchers/my/${voucher.voucher_id}`
      );

      setSelectedVoucher(response.voucher || response.data || voucher);
    } catch (err) {
      setError(err.message || "Unable to load full voucher details.");
    } finally {
      setDetailsLoading(false);
    }

    try {
      const response = await apiRequest(
        `/vouchers/my/${voucher.voucher_id}/activity`
      );

      setActivities(response.activities || []);
    } catch (err) {
      setActivityError(
        err.message || "Unable to load activity history."
      );
    } finally {
      setActivityLoading(false);
    }
  };

  const handleDelete = async (voucher) => {
    if (voucher.status !== "Draft") {
      setError("Only draft vouchers can be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Delete voucher "${voucher.title || voucher.voucher_id}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    clearMessages();
    setActionId(voucher.voucher_id);

    try {
      await apiRequest(`/vouchers/${voucher.voucher_id}`, {
        method: "DELETE",
      });

      setSuccess("Draft voucher deleted successfully.");

      if (selectedVoucher?.voucher_id === voucher.voucher_id) {
        setSelectedVoucher(null);
        setActivities([]);
      }

      setLoading(true);
      await fetchVouchers();
    } catch (err) {
      setError(err.message || "Unable to delete the voucher.");
    } finally {
      setActionId(null);
    }
  };

  const handleSignatureUpload = async (voucherId) => {
    clearMessages();

    if (!signatureFile || signatureVoucherId !== voucherId) {
      setError("Choose a PNG or JPEG signature image first.");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg"];

    if (!allowedTypes.includes(signatureFile.type)) {
      setError("Signature must be a PNG or JPEG image.");
      return;
    }

    if (signatureFile.size > 2 * 1024 * 1024) {
      setError("Signature image must be no larger than 2 MB.");
      return;
    }

    const data = new FormData();
    data.append("signature", signatureFile);

    setActionId(voucherId);

    try {
      await apiRequest(`/vouchers/${voucherId}/signature`, {
        method: "POST",
        body: data,
      });

      setSuccess("Employee signature uploaded successfully.");
      setSignatureFile(null);
      setSignatureVoucherId(null);

      const input = document.getElementById(`signature-${voucherId}`);
      if (input) input.value = "";

      setLoading(true);
      await fetchVouchers();

      if (selectedVoucher?.voucher_id === voucherId) {
        await handleViewDetails({ voucher_id: voucherId });
      }
    } catch (err) {
      setError(err.message || "Unable to upload the signature.");
    } finally {
      setActionId(null);
    }
  };

  const handleSubmitForApproval = async (voucher) => {
    if (voucher.status !== "Draft") {
      setError("Only draft vouchers can be submitted.");
      return;
    }

    const confirmed = window.confirm(
      "Submit this voucher to the Director for approval? You will no longer be able to edit or delete it."
    );

    if (!confirmed) return;

    clearMessages();
    setActionId(voucher.voucher_id);

    try {
      await apiRequest(`/vouchers/${voucher.voucher_id}/submit`, {
        method: "POST",
      });

      setSuccess("Voucher submitted for Director approval.");
      setSelectedVoucher(null);
      setActivities([]);
      setLoading(true);
      await fetchVouchers();
    } catch (err) {
      setError(err.message || "Unable to submit the voucher.");
    } finally {
      setActionId(null);
    }
  };

  const renderField = (label, name, options = {}) => (
    <div className="voucher-field" key={name}>
      <label htmlFor={name}>{label} *</label>

      {options.select ? (
        <select
          id={name}
          name={name}
          value={form[name]}
          onChange={handleChange}
          required
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={name}
          name={name}
          type={options.type || "text"}
          value={form[name]}
          onChange={handleChange}
          placeholder={options.placeholder || ""}
          min={options.min}
          max={options.max}
          step={options.step}
          maxLength={options.maxLength}
          required
        />
      )}
    </div>
  );

  return (
    <div className="dashboard-content">
      <div className="section-heading">
        <div>
          <p className="dashboard-eyebrow">EXPENSE MANAGEMENT</p>
          <h1>My Vouchers</h1>
          <p>View, update, and track your expense vouchers.</p>
        </div>

        {!showForm && (
          <button
            type="button"
            className="primary-button"
            onClick={openCreateForm}
          >
            + Create Voucher
          </button>
        )}
      </div>

      {error && (
        <div className="voucher-message voucher-message-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="voucher-message voucher-message-success" role="status">
          {success}
        </div>
      )}

      {showForm && (
        <section className="dashboard-info-panel voucher-form-panel">
          <h2>{editingId ? "Edit Draft Voucher" : "Create Expense Voucher"}</h2>
          <p>Fields marked with * are required.</p>

          <form onSubmit={handleSaveVoucher} className="voucher-form">
            <div className="voucher-form-grid">
              {renderField("Voucher Date", "voucher_date", {
                type: "date",
                max: today(),
              })}

              {renderField("Expense Date", "expense_date", {
                type: "date",
                max: form.voucher_date || today(),
              })}

              {renderField("Department", "department", {
                placeholder: "e.g. Finance",
                maxLength: 100,
              })}

              {renderField("Expense Title", "title", {
                placeholder: "e.g. Client Meeting Travel",
                maxLength: 200,
              })}

              {renderField("Expense Category", "category", {
                select: true,
              })}

              {renderField("Amount (₹)", "amount", {
                type: "number",
                placeholder: "Enter amount",
                min: "0.01",
                max: "9999999999.99",
                step: "0.01",
              })}

              <div className="voucher-field voucher-field-full">
                <label htmlFor="description">Expense Description *</label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Explain the purpose of this expense..."
                  rows={4}
                  maxLength={2000}
                  required
                />
              </div>
            </div>

            <div className="voucher-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Draft"
                    : "Save as Draft"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="dashboard-info-panel voucher-records-panel">
        <div className="voucher-records-heading">
          <div>
            <h3>Voucher Records</h3>
            <p>All vouchers associated with your employee account.</p>
          </div>

          <span className="overview-badge">
            {filteredVouchers.length} of {vouchers.length}{" "}
            {vouchers.length === 1 ? "Voucher" : "Vouchers"}
          </span>
        </div>

        {/* Search and status filters */}
        <div className="voucher-filter-section">
          <div className="voucher-search-control">
            <label htmlFor="voucher-search">Search vouchers</label>
            <input
              id="voucher-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search voucher number, title, or category..."
            />
          </div>

          <div
            className="voucher-status-filters"
            aria-label="Filter vouchers by status"
          >
            {STATUS_FILTERS.map((status) => (
              <button
                type="button"
                key={status}
                className={`voucher-filter-button ${
                  statusFilter === status ? "active" : ""
                }`}
                onClick={() => setStatusFilter(status)}
                aria-pressed={statusFilter === status}
              >
                {status}
                <span>{statusCounts[status]}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p>Loading your vouchers...</p>
        ) : filteredVouchers.length === 0 ? (
          <div className="voucher-empty-state">
            <h3>
              {vouchers.length === 0
                ? "No vouchers yet"
                : "No matching vouchers"}
            </h3>

            <p>
              {vouchers.length === 0
                ? "Create your first expense voucher to get started."
                : "Try a different status filter or search term."}
            </p>

            {(statusFilter !== "All" || searchTerm) && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setStatusFilter("All");
                  setSearchTerm("");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="voucher-table-wrapper">
            <table className="voucher-table">
              <thead>
                <tr>
                  <th>Voucher No.</th>
                  <th>Title</th>
                  <th>Expense Date</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredVouchers.map((voucher) => {
                  const isDraft = voucher.status === "Draft";
                  const busy = actionId === voucher.voucher_id;

                  return (
                    <tr key={voucher.voucher_id}>
                      <td>
                        {voucher.voucher_number ||
                          `Draft #${voucher.voucher_id}`}
                      </td>

                      <td>{voucher.title || "Untitled voucher"}</td>
                      <td>{formatDate(voucher.expense_date)}</td>
                      <td>{voucher.category || "—"}</td>
                      <td>{formatAmount(voucher.amount)}</td>

                      <td>
                        <span
                          className={`voucher-status ${getStatusClass(
                            voucher.status
                          )}`}
                        >
                          {voucher.status}
                        </span>
                      </td>

                      <td>
                        <div className="voucher-actions">
                          <button
                            type="button"
                            className="secondary-button voucher-action-button"
                            onClick={() => handleViewDetails(voucher)}
                          >
                            View
                          </button>

                          {isDraft && (
                            <>
                              <button
                                type="button"
                                className="secondary-button voucher-action-button"
                                onClick={() => openEditForm(voucher)}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="secondary-button voucher-action-button"
                                onClick={() => handleDelete(voucher)}
                                disabled={busy}
                              >
                                {busy ? "Please wait..." : "Delete"}
                              </button>

                              <button
                                type="button"
                                className="primary-button voucher-action-button"
                                onClick={() =>
                                  handleSubmitForApproval(voucher)
                                }
                                disabled={busy}
                              >
                                Submit
                              </button>
                            </>
                          )}
                        </div>

                        {isDraft && (
                          <div className="voucher-signature-control">
                            <label
                              htmlFor={`signature-${voucher.voucher_id}`}
                            >
                              Employee signature (PNG/JPEG, max 2 MB)
                            </label>

                            <input
                              id={`signature-${voucher.voucher_id}`}
                              type="file"
                              accept="image/png,image/jpeg"
                              onChange={(event) => {
                                setSignatureFile(
                                  event.target.files?.[0] || null
                                );
                                setSignatureVoucherId(voucher.voucher_id);
                                clearMessages();
                              }}
                            />

                            <button
                              type="button"
                              className="secondary-button voucher-action-button"
                              onClick={() =>
                                handleSignatureUpload(voucher.voucher_id)
                              }
                              disabled={busy}
                            >
                              Upload Signature
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedVoucher && (
        <div
          className="voucher-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedVoucher(null);
              setActivities([]);
            }
          }}
        >
          <section
            className="voucher-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-details-title"
          >
            <div className="voucher-modal-heading">
              <div>
                <p className="dashboard-eyebrow">VOUCHER DETAILS</p>
                <h2 id="voucher-details-title">
                  {selectedVoucher.voucher_number ||
                    `Draft #${selectedVoucher.voucher_id}`}
                </h2>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelectedVoucher(null);
                  setActivities([]);
                }}
              >
                Close
              </button>
            </div>

            {detailsLoading ? (
              <p>Loading voucher details...</p>
            ) : (
              <div className="voucher-details-grid">
                <div>
                  <span>Title</span>
                  <strong>{selectedVoucher.title || "—"}</strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>{selectedVoucher.status || "—"}</strong>
                </div>

                <div>
                  <span>Employee</span>
                  <strong>{selectedVoucher.employee_name || "—"}</strong>
                </div>

                <div>
                  <span>Employee Code</span>
                  <strong>{selectedVoucher.employee_code || "—"}</strong>
                </div>

                <div>
                  <span>Department</span>
                  <strong>{selectedVoucher.department || "—"}</strong>
                </div>

                <div>
                  <span>Category</span>
                  <strong>{selectedVoucher.category || "—"}</strong>
                </div>

                <div>
                  <span>Voucher Date</span>
                  <strong>{formatDate(selectedVoucher.voucher_date)}</strong>
                </div>

                <div>
                  <span>Expense Date</span>
                  <strong>{formatDate(selectedVoucher.expense_date)}</strong>
                </div>

                <div>
                  <span>Amount</span>
                  <strong>{formatAmount(selectedVoucher.amount)}</strong>
                </div>

                <div className="voucher-detail-full">
                  <span>Description</span>
                  <p>
                    {selectedVoucher.description || "No description provided."}
                  </p>
                </div>

                {selectedVoucher.rejection_reason && (
                  <div className="voucher-detail-full">
                    <span>Rejection Reason</span>
                    <p>{selectedVoucher.rejection_reason}</p>
                  </div>
                )}
              </div>
            )}

            <section className="voucher-activity-section">
              <div className="voucher-activity-heading">
                <div>
                  <p className="dashboard-eyebrow">AUDIT TRAIL</p>
                  <h3>Activity History</h3>
                </div>

                <span className="overview-badge">
                  {activities.length}{" "}
                  {activities.length === 1 ? "Event" : "Events"}
                </span>
              </div>

              {activityLoading ? (
                <p>Loading activity history...</p>
              ) : activityError ? (
                <div
                  className="voucher-message voucher-message-error"
                  role="alert"
                >
                  {activityError}
                </div>
              ) : activities.length === 0 ? (
                <div className="voucher-empty-state">
                  <p>No activity history is available for this voucher.</p>
                </div>
              ) : (
                <ol className="voucher-activity-list">
                  {activities.map((activity) => (
                    <li
                      className="voucher-activity-item"
                      key={activity.activity_id}
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

                        <p>{activity.details || "No additional details."}</p>

                        <div className="voucher-activity-actor">
                          <span>{activity.actor_name || "System"}</span>

                          {activity.actor_role && (
                            <span className="voucher-activity-role">
                              {activity.actor_role}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {selectedVoucher.status === "Draft" && (
              <div className="voucher-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => openEditForm(selectedVoucher)}
                >
                  Edit Draft
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleSubmitForApproval(selectedVoucher)}
                  disabled={actionId === selectedVoucher.voucher_id}
                >
                  Submit for Approval
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      <p className="dashboard-footer">
        VoucherFlow · Expense Voucher Management System
      </p>
    </div>
  );
}

export default Vouchers;
