
import { useEffect, useState } from "react";
import { apiRequest } from "./api";

function Director() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [signatureFiles, setSignatureFiles] = useState({});
  const [rejectionReason, setRejectionReason] = useState({});
  const [processingId, setProcessingId] = useState(null);

  const loadPendingVouchers = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest("/director/pending");
      const records = response.vouchers || response.data || [];
      setVouchers(Array.isArray(records) ? records : []);
    } catch (err) {
      setError(err.message || "Unable to load pending vouchers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingVouchers();
  }, []);

  const getVoucherId = (voucher) =>
    voucher.voucher_id ?? voucher.id;

  const uploadSignature = async (voucher) => {
    const id = getVoucherId(voucher);
    const file = signatureFiles[id];

    if (!file) {
      setError("Please select a Director signature image first.");
      return;
    }

    const formData = new FormData();
    formData.append("signature", file);

    setProcessingId(id);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest(
        `/director/${id}/signature`,
        {
          method: "POST",
          body: formData,
        }
      );

      setMessage(response.message || "Signature uploaded successfully.");
      await loadPendingVouchers();
    } catch (err) {
      setError(err.message || "Signature upload failed.");
    } finally {
      setProcessingId(null);
    }
  };

  const approveVoucher = async (voucher) => {
    const id = getVoucherId(voucher);

    if (
      !window.confirm(
        `Are you sure you want to approve voucher ${
          voucher.voucher_number || id
        }?`
      )
    ) {
      return;
    }

    setProcessingId(id);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest(
        `/director/${id}/approve`,
        { method: "POST" }
      );

      setMessage(response.message || "Voucher approved successfully.");
      setSelectedVoucher(null);
      await loadPendingVouchers();
    } catch (err) {
      setError(err.message || "Unable to approve voucher.");
    } finally {
      setProcessingId(null);
    }
  };

  const rejectVoucher = async (voucher) => {
    const id = getVoucherId(voucher);
    const reason = (rejectionReason[id] || "").trim();

    if (!reason) {
      setError("Please enter a reason for rejecting this voucher.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to reject voucher ${
          voucher.voucher_number || id
        }?`
      )
    ) {
      return;
    }

    setProcessingId(id);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest(
        `/director/${id}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ rejection_reason: reason }),
        }
      );

      setMessage(response.message || "Voucher rejected successfully.");
      setSelectedVoucher(null);
      await loadPendingVouchers();
    } catch (err) {
      setError(err.message || "Unable to reject voucher.");
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-IN");
  };

  const formatAmount = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
    });

  if (loading) {
    return (
      <div className="voucher-form-panel">
        <h2>Director Approval</h2>
        <p>Loading pending vouchers...</p>
      </div>
    );
  }

  return (
    <div className="director-page">
      <div className="section-heading">
        <div>
          <h2>Director Approval</h2>
          <p>Review employee expenses and make approval decisions.</p>
        </div>

        <button
          type="button"
          className="voucher-secondary-button"
          onClick={loadPendingVouchers}
          disabled={processingId !== null}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="voucher-message error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="voucher-message success" role="status">
          {message}
        </div>
      )}

      <div className="director-summary">
        <div className="dashboard-card">
          <span>Pending Vouchers</span>
          <h3>{vouchers.length}</h3>
        </div>
      </div>

      {vouchers.length === 0 ? (
        <div className="voucher-records-panel">
          <h3>No Pending Vouchers</h3>
          <p>There are currently no vouchers awaiting your approval.</p>
        </div>
      ) : (
        <div className="voucher-records-panel">
          <div className="voucher-table-wrapper">
            <table className="voucher-table">
              <thead>
                <tr>
                  <th>Voucher No.</th>
                  <th>Employee</th>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {vouchers.map((voucher) => {
                  const id = getVoucherId(voucher);

                  return (
                    <tr key={id}>
                      <td>
                        {voucher.voucher_number || `VCH-${id}`}
                      </td>
                      <td>
                        {voucher.employee_name || "—"}
                        <br />
                        <small>
                          {voucher.employee_code || ""}
                        </small>
                      </td>
                      <td>{voucher.title || "—"}</td>
                      <td>{formatDate(voucher.voucher_date)}</td>
                      <td>{formatAmount(voucher.amount)}</td>
                      <td>
                        <span className="voucher-status pending">
                          {voucher.status || "Pending Approval"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="voucher-action-button"
                          onClick={() => {
                            setSelectedVoucher(voucher);
                            setError("");
                            setMessage("");
                          }}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            className="voucher-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="director-review-title"
          >
            <div className="section-heading">
              <h2 id="director-review-title">Review Voucher</h2>
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
                <strong>Title:</strong>{" "}
                {selectedVoucher.title || "—"}
              </p>
              <p>
                <strong>Description:</strong>{" "}
                {selectedVoucher.description || "—"}
              </p>
            </div>

            <div className="voucher-signature-control">
              <h3>Director Signature</h3>
              <p>Select a PNG or JPEG signature image before approving.</p>

              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  const id = getVoucherId(selectedVoucher);

                  if (file) {
                    setSignatureFiles((previous) => ({
                      ...previous,
                      [id]: file,
                    }));
                  }
                }}
              />

              <button
                type="button"
                className="voucher-secondary-button"
                onClick={() => uploadSignature(selectedVoucher)}
                disabled={
                  processingId !== null ||
                  !signatureFiles[getVoucherId(selectedVoucher)]
                }
              >
                Upload Signature
              </button>
            </div>

            <div className="voucher-signature-control">
              <label htmlFor="rejection-reason">
                Rejection Reason
              </label>
              <textarea
                id="rejection-reason"
                rows="3"
                placeholder="Enter the reason if rejecting this voucher..."
                value={
                  rejectionReason[getVoucherId(selectedVoucher)] || ""
                }
                onChange={(event) => {
                  const id = getVoucherId(selectedVoucher);

                  setRejectionReason((previous) => ({
                    ...previous,
                    [id]: event.target.value,
                  }));
                }}
              />
            </div>

            <div className="voucher-actions">
              <button
                type="button"
                className="voucher-submit-button"
                onClick={() => approveVoucher(selectedVoucher)}
                disabled={processingId !== null}
              >
                {processingId === getVoucherId(selectedVoucher)
                  ? "Processing..."
                  : "Approve Voucher"}
              </button>

              <button
                type="button"
                className="voucher-delete-button"
                onClick={() => rejectVoucher(selectedVoucher)}
                disabled={processingId !== null}
              >
                Reject Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Director;
