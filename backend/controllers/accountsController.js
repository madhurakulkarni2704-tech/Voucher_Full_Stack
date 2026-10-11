
const pool = require("../config/db");

// Get summary statistics for the Accounts dashboard
const getAccountsDashboardSummary = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS total_vouchers,
        COALESCE(SUM(status = 'Draft'), 0) AS draft_vouchers,
        COALESCE(SUM(status = 'Pending Approval'), 0) AS pending_vouchers,
        COALESCE(SUM(status = 'Approved'), 0) AS approved_vouchers,
        COALESCE(SUM(status = 'Rejected'), 0) AS rejected_vouchers,
        COALESCE(
          SUM(CASE WHEN status = 'Approved' THEN amount ELSE 0 END),
          0
        ) AS approved_amount
      FROM vouchers
    `);

    res.status(200).json({
      success: true,
      message: "Accounts dashboard summary retrieved successfully.",
      summary: rows[0],
    });
  } catch (error) {
    console.error("Accounts dashboard summary error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve Accounts dashboard summary.",
    });
  }
};

module.exports = {
  getAccountsDashboardSummary,
};
