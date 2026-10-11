
const express = require("express");
const router = express.Router();

const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const {
  getAllVouchersForAccounts,
} = require("../controllers/voucherController");

const {
  getAccountsDashboardSummary,
} = require("../controllers/accountsController");

// All Accounts routes require authentication
router.use(authenticateToken);

// Only users with the Accounts role can access these routes
router.use(authorizeRoles("Accounts"));

// Dashboard summary
router.get("/dashboard-summary", getAccountsDashboardSummary);

// View all vouchers with search, filtering, and sorting
router.get("/vouchers", getAllVouchersForAccounts);

module.exports = router;
