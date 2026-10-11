
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api";

function Accounts() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  const loadVouchers = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest("/accounts/vouchers");

      const records =
        response.vouchers ||
        response.data ||
        response.records ||
        [];

      setVouchers(Array.isArray(records) ? records : []);
    } catch (err) {
      setError(err.message || "Unable to load vouchers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();
  }, []);

  const filteredVouchers = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return vouchers.filter((voucher) => {
      const matchesSearch = [
        voucher.voucher_number,
        voucher.employee_name,
        voucher.employee_code,
        voucher.department,
        voucher.title,
        voucher.category,
      ].some((value) =>
        String(value || "").toLowerCase().includes(searchText)
      );

      const matchesStatus =
        statusFilter === "All" || voucher.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [vouchers, search, statusFilter]);

  const formatDate = (value) => {
    if (!value) return "—";

    const text = String(value);

    // Preserve date-only values without timezone shifting.
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      const [year, month, day] = text.slice(0, 10).split("-");
      return `${day}/${month}/${year}`;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? text
      : date.toLocaleDateString("en-IN");
  };

  const formatAmount = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
    });

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

  const totalAmount = filteredVouchers.reduce(
    (sum, voucher) => sum + Number(voucher.amount || 0),
    0
  );

  return (
    <div className="accounts-page">
      <section className="dashboard-welcome">
        <div>
          <p className="dashboard-eyebrow">ACCOUNTS WORKSPACE</p>
          <h1>All Vouchers</h1>
          <p>Review expense records and track voucher statuses.</p>
        </div>
        <div className="welcome-decoration">₹</div>
      </section>

      {error && (
        <div className="voucher-message voucher-message-error" role="alert">
          {error}
          <button
            type="button"
            className="accounts-retry-button"
            onClick={loadVouchers}
          >
            Try Again
          </button>
        </div>
      )}

      <section className="accounts-summary-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-icon">▤</div>
          <h3>All Vouchers</h3>
          <p className="dashboard-card-value">{vouchers.length}</p>
          <p>Total records available.</p>
        </article>

        <article className="dashboard-card">
          <div className="dashboard-card-icon">✓</div>
          <h3>Approved</h3>
          <p className="dashboard-card-value">
            {vouchers.filter((voucher) => voucher.status === "Approved").length}
          </p>
          <p>Vouchers approved by the Director.</p>
        </article>

        <article className="dashboard-card">
          <div className="dashboard-card-icon">₹</div>
          <h3>Filtered Amount</h3>
          <p className="dashboard-card-value accounts-amount">
            {formatAmount(totalAmount)}
          </p>
          <p>Combined amount of matching records.</p>
        </article>
      </section>

      <section className="voucher-records-panel accounts-records-panel">
        <div className="accounts-toolbar">
          <div>
            <h2>Voucher Records</h2>
            <p>Search, filter, and inspect expense vouchers.</p>
          </div>

          <button
            type="button"
            className="voucher-secondary-button"
            onClick={loadVouchers}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="accounts-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search voucher, employee, department..."
            aria-label="Search vouchers"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter vouchers by status"
          >
            <option value="All">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="accounts-empty-state">
            Loading voucher records...
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="accounts-empty-state">
            <h3>No matching vouchers</h3>
            <p>
              {vouchers.length === 0
                ? "No voucher records were returned by the server."
                : "Try changing your search or status filter."}
            </p>
            {(search || statusFilter !== "All") && (
              <button
                type="button"
                className="voucher-secondary-button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("All");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="voucher-table-wrapper">
            <table className="voucher-table accounts-table">
              <thead>
                <tr>
                  <th>Voucher No.</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Expense Date</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredVouchers.map((voucher, index) => (
                  <tr
                    key={
                      voucher.voucher_id ??
                      voucher.id ??
                      voucher.voucher_number ??
                      index
                    }
                  >
                    <td>
                      {voucher.voucher_number ||
                        `VCH-${voucher.voucher_id ?? voucher.id ?? "—"}`}
                    </td>
                    <td>
                      {voucher.employee_name || "—"}
                      {voucher.employee_code && (
                        <small className="accounts-employee-code">
                          {voucher.employee_code}
                        </small>
                      )}
                    </td>
                    <td>{voucher.department || "—"}</td>
                    <td>{formatDate(voucher.expense_date || voucher.voucher_date)}</td>
                    <td>{voucher.category || "—"}</td>
                    <td>{formatAmount(voucher.amount)}</td>
                    <td>
                      <span
                        className={`voucher-status ${getStatusClass(
                          voucher.status
                        )}`}
                      >
                        {voucher.status || "Draft"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="voucher-action-button"
                        onClick={() => setSelectedVoucher(voucher)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <p className="accounts-result-count">
            Showing {filteredVouchers.length} of {vouchers.length} vouchers
          </p>
        )}
      </section>

      {selectedVoucher && (
        <div
          className="voucher-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedVoucher(null);
            }
          }}
        >
          <div
            className="voucher-modal accounts-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="accounts-detail-title"
          >
            <div className="section-heading">
              <div>
                <p className="dashboard-eyebrow">VOUCHER DETAILS</p>
                <h2 id="accounts-detail-title">Expense Record</h2>
              </div>

              <button
                type="button"
                className="voucher-secondary-button"
                onClick={() => setSelectedVoucher(null)}
              >
                Close
              </button>
            </div>

            <div className="voucher-details-grid">
              <p>
                <strong>Voucher Number:</strong>{" "}
                {selectedVoucher.voucher_number || "—"}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                {selectedVoucher.status || "Draft"}
              </p>
              <p>
                <strong>Employee:</strong>{" "}
                {selectedVoucher.employee_name || "—"}
              </p>
              <p>
                <strong>Employee Code:</strong>{" "}
                {selectedVoucher.employee_code || "—"}
              </p>
              <p>
                <strong>Department:</strong>{" "}
                {selectedVoucher.department || "—"}
              </p>
              <p>
                <strong>Voucher Date:</strong>{" "}
                {formatDate(selectedVoucher.voucher_date)}
              </p>
              <p>
                <strong>Expense Date:</strong>{" "}
                {formatDate(selectedVoucher.expense_date)}
              </p>
              <p>
                <strong>Category:</strong>{" "}
                {selectedVoucher.category || "—"}
              </p>
              <p>
                <strong>Amount:</strong>{" "}
                {formatAmount(selectedVoucher.amount)}
              </p>
              <p>
                <strong>Title:</strong> {selectedVoucher.title || "—"}
              </p>
              <p>
                <strong>Description:</strong>{" "}
                {selectedVoucher.description || "—"}
              </p>
              {selectedVoucher.rejection_reason && (
                <p>
                  <strong>Rejection Reason:</strong>{" "}
                  {selectedVoucher.rejection_reason}
                </p>
              )}
            </div>

            <div className="voucher-modal-actions">
              <button
                type="button"
                className="voucher-secondary-button"
                onClick={() => setSelectedVoucher(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Accounts;
