
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const voucherRoutes = require("./routes/voucherRoutes");
const directorRoutes = require("./routes/directorRoutes");
const accountsRoutes = require("./routes/accountsRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Expense Voucher Management API is running.",
  });
});

// API and MySQL health check
app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT DATABASE() AS databaseName, 1 AS connectionTest"
    );

    res.json({
      success: true,
      message: "Backend and MySQL connected successfully.",
      database: rows[0].databaseName,
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed. Check backend configuration.",
    });
  }
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Employee voucher routes
app.use("/api/vouchers", voucherRoutes);

// Director routes
app.use("/api/director", directorRoutes);

// Accounts routes
app.use("/api/accounts", accountsRoutes);

// Handle unknown API endpoints
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Request error:", err.message);

  // Unsupported signature file type
  if (err.message === "Only PNG and JPEG signature images are allowed.") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Multer file-size and upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Signature file exceeds the 2 MB size limit.",
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected file field. Use the field name 'signature'.",
      });
    }

    return res.status(400).json({
      success: false,
      message: "Signature upload failed. Please check the selected file.",
    });
  }

  // Handle malformed JSON requests
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    Object.prototype.hasOwnProperty.call(err, "body")
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body.",
    });
  }

  // Avoid exposing internal server details
  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
