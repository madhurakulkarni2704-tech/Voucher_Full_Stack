
const express = require("express");
const router = express.Router();

const uploadSignature = require("../middleware/uploadMiddleware");

const {
  createVoucher,
  getMyVouchers,
  getMyVoucherById,
  getVoucherActivity,
  updateVoucher,
  deleteVoucher,
  submitVoucher,
  uploadEmployeeSignature,
  getEmployeeDashboardSummary,
} = require("../controllers/voucherController");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// All routes require authentication
router.use(authenticateToken);

// Employee-only routes
router.use(authorizeRoles("Employee"));

// Create a voucher draft
router.post("/", createVoucher);

// Get all vouchers belonging to the logged-in employee
router.get("/my", getMyVouchers);

// Get employee dashboard summary
router.get("/dashboard-summary", getEmployeeDashboardSummary);

// Get one voucher's activity history
// Keep this before the general /my/:id route
router.get("/my/:id/activity", getVoucherActivity);

// Get one voucher belonging to the logged-in employee
router.get("/my/:id", getMyVoucherById);

// Update a draft voucher
router.put("/:id", updateVoucher);

// Delete a draft voucher
router.delete("/:id", deleteVoucher);

// Submit a voucher for approval
router.post("/:id/submit", submitVoucher);

// Upload employee signature
router.post(
  "/:id/signature",
  uploadSignature.single("signature"),
  uploadEmployeeSignature
);

module.exports = router;
