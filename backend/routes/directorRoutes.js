const express = require("express");
const router = express.Router();

const uploadSignature = require("../middleware/uploadMiddleware");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const {
  getPendingVouchers,
  getDirectorDashboardSummary,
  getDirectorRecentActivity,
  uploadDirectorSignature,
  approveVoucher,
  rejectVoucher,
} = require("../controllers/voucherController");

// All routes require an authenticated Director.
router.use(authenticateToken);
router.use(authorizeRoles("Director"));

// Director dashboard statistics.
router.get("/dashboard-summary", getDirectorDashboardSummary);

// Recent activity across all expense vouchers.
router.get("/recent-activity", getDirectorRecentActivity);

// View pending vouchers.
router.get("/pending", getPendingVouchers);

// Upload Director signature.
router.post(
  "/:id/signature",
  uploadSignature.single("signature"),
  uploadDirectorSignature
);

// Approve a voucher.
router.post("/:id/approve", approveVoucher);

// Reject a voucher.
router.post("/:id/reject", rejectVoucher);

module.exports = router;