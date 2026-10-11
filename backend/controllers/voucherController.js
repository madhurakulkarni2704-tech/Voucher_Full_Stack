const pool = require("../config/db");
const fs = require("fs");
const path = require("path");

// Validate real calendar dates in YYYY-MM-DD format
function isValidDate(value) {
  if (typeof value !== "string") return false;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// Validate voucher form fields
function validateVoucherInput({
  voucher_date,
  expense_date,
  department,
  title,
  category,
  description,
  amount
}) {
  if (typeof title !== "string" || !title.trim()) {
    return "Title is required.";
  }

  if (typeof department !== "string" || !department.trim()) {
    return "Department is required.";
  }

  if (typeof category !== "string" || !category.trim()) {
    return "Category is required.";
  }

  if (typeof description !== "string" || !description.trim()) {
    return "Description is required.";
  }

  if (!isValidDate(voucher_date)) {
    return "Please provide a valid voucher date in YYYY-MM-DD format.";
  }

  if (!isValidDate(expense_date)) {
    return "Please provide a valid expense date in YYYY-MM-DD format.";
  }

  if (expense_date > voucher_date) {
    return "Expense date cannot be later than voucher date.";
  }

  if (
    amount === undefined ||
    amount === null ||
    String(amount).trim() === "" ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) <= 0
  ) {
    return "Amount must be a valid number greater than zero.";
  }

  return null;
}

// Record voucher activity
async function logActivity(
  connection,
  voucherId,
  userId,
  action,
  details = null
) {
  await connection.execute(
    `INSERT INTO voucher_activity
      (voucher_id, actor_user_id, action, details)
     VALUES (?, ?, ?, ?)`,
    [voucherId, userId, action, details]
  );
}

// Safely remove a stored upload
function removeStoredUpload(relativePath) {
  if (!relativePath || typeof relativePath !== "string") return;

  const uploadsDirectory = path.resolve(__dirname, "..", "uploads");
  const normalizedPath = relativePath.replace(/\\/g, "/");

  if (!normalizedPath.startsWith("uploads/")) return;

  const filename = normalizedPath.slice("uploads/".length);

  if (!filename || filename.includes("/") || filename.includes("..")) {
    return;
  }

  const absolutePath = path.resolve(uploadsDirectory, filename);

  if (!absolutePath.startsWith(uploadsDirectory + path.sep)) return;

  fs.unlink(absolutePath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Could not remove uploaded file:", error.message);
    }
  });
}

// Validate actual PNG/JPEG file signature bytes
function validateUploadedSignature(filePath) {
  const uploadsDirectory = path.resolve(__dirname, "..", "uploads");
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(uploadsDirectory + path.sep)) {
    return false;
  }

  const descriptor = fs.openSync(resolvedPath, "r");

  try {
    const buffer = Buffer.alloc(8);

    const bytesRead = fs.readSync(
      descriptor,
      buffer,
      0,
      buffer.length,
      0
    );

    const isPng =
      bytesRead >= 8 &&
      buffer.equals(
        Buffer.from([
          0x89, 0x50, 0x4E, 0x47,
          0x0D, 0x0A, 0x1A, 0x0A
        ])
      );

    const isJpeg =
      bytesRead >= 3 &&
      buffer[0] === 0xFF &&
      buffer[1] === 0xD8 &&
      buffer[2] === 0xFF;

    return isPng || isJpeg;
  } finally {
    fs.closeSync(descriptor);
  }
}

// EMPLOYEE: CREATE A DRAFT VOUCHER
async function createVoucher(req, res) {
  const {
    voucher_date,
    expense_date,
    department,
    title,
    category,
    description,
    amount
  } = req.body;

  const validationError = validateVoucherInput({
    voucher_date,
    expense_date,
    department,
    title,
    category,
    description,
    amount
  });

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError
    });
  }

  try {
    const [users] = await pool.execute(
      `SELECT user_id, full_name, employee_code
       FROM users
       WHERE user_id = ? AND is_active = 1 AND role = 'Employee'`,
      [req.user.userId]
    );

    if (!users.length) {
      return res.status(403).json({
        success: false,
        message: "An active Employee account is required."
      });
    }

    const employee = users[0];

    const [result] = await pool.execute(
      `INSERT INTO vouchers (
        employee_user_id,
        employee_name,
        employee_code,
        voucher_date,
        expense_date,
        department,
        title,
        category,
        description,
        amount,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft')`,
      [
        employee.user_id,
        employee.full_name,
        employee.employee_code,
        voucher_date,
        expense_date,
        department.trim(),
        title.trim(),
        category.trim(),
        description.trim(),
        Number(amount)
      ]
    );

    const voucherNumber = `VCH-${new Date().getFullYear()}-${String(
      result.insertId
    ).padStart(6, "0")}`;

    await pool.execute(
      "UPDATE vouchers SET voucher_number = ? WHERE voucher_id = ?",
      [voucherNumber, result.insertId]
    );

    const connection = await pool.getConnection();

    try {
      await logActivity(
        connection,
        result.insertId,
        req.user.userId,
        "Draft Created",
        "Employee created a voucher draft."
      );
    } finally {
      connection.release();
    }

    return res.status(201).json({
      success: true,
      message: "Voucher draft created successfully.",
      voucher_id: result.insertId,
      voucher_number: voucherNumber
    });
  } catch (error) {
    console.error("Create voucher error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create voucher."
    });
  }
}

// EMPLOYEE: GET OWN VOUCHERS
async function getMyVouchers(req, res) {
  try {
    const [vouchers] = await pool.execute(
      `SELECT *
       FROM vouchers
       WHERE employee_user_id = ?
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    return res.json({ success: true, vouchers });
  } catch (error) {
    console.error("Get my vouchers error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your vouchers."
    });
  }
}

// EMPLOYEE: GET ONE OWN VOUCHER
async function getMyVoucherById(req, res) {
  try {
    const [vouchers] = await pool.execute(
      `SELECT *
       FROM vouchers
       WHERE voucher_id = ? AND employee_user_id = ?`,
      [req.params.id, req.user.userId]
    );

    if (!vouchers.length) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found."
      });
    }

    return res.json({
      success: true,
      voucher: vouchers[0]
    });
  } catch (error) {
    console.error("Get voucher error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve voucher."
    });
  }
}

// EMPLOYEE: GET ACTIVITY HISTORY FOR OWN VOUCHER
async function getVoucherActivity(req, res) {
  try {
    const voucherId = req.params.id;

    const [vouchers] = await pool.execute(
      `SELECT voucher_id
       FROM vouchers
       WHERE voucher_id = ?
         AND employee_user_id = ?`,
      [voucherId, req.user.userId]
    );

    if (!vouchers.length) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found."
      });
    }

    const [activities] = await pool.execute(
      `SELECT
         va.activity_id,
         va.voucher_id,
         va.action,
         va.details,
         va.created_at,
         u.full_name AS actor_name,
         u.role AS actor_role
       FROM voucher_activity va
       LEFT JOIN users u
         ON u.user_id = va.actor_user_id
       WHERE va.voucher_id = ?
       ORDER BY va.created_at DESC, va.activity_id DESC`,
      [voucherId]
    );

    return res.status(200).json({
      success: true,
      count: activities.length,
      activities
    });
  } catch (error) {
    console.error("Get voucher activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve voucher activity history."
    });
  }
}

// EMPLOYEE: UPDATE A DRAFT
async function updateVoucher(req, res) {
  const {
    voucher_date,
    expense_date,
    department,
    title,
    category,
    description,
    amount
  } = req.body;

  const validationError = validateVoucherInput({
    voucher_date,
    expense_date,
    department,
    title,
    category,
    description,
    amount
  });

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError
    });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE vouchers
       SET voucher_date = ?,
           expense_date = ?,
           department = ?,
           title = ?,
           category = ?,
           description = ?,
           amount = ?
       WHERE voucher_id = ?
         AND employee_user_id = ?
         AND status = 'Draft'`,
      [
        voucher_date,
        expense_date,
        department.trim(),
        title.trim(),
        category.trim(),
        description.trim(),
        Number(amount),
        req.params.id,
        req.user.userId
      ]
    );

    if (!result.affectedRows) {
      return res.status(409).json({
        success: false,
        message: "Voucher not found, or only Draft vouchers can be edited."
      });
    }

    return res.json({
      success: true,
      message: "Draft voucher updated successfully."
    });
  } catch (error) {
    console.error("Update voucher error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update voucher."
    });
  }
}
// EMPLOYEE: DELETE A DRAFT
async function deleteVoucher(req, res) {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT voucher_id, status, employee_signature_path
       FROM vouchers
       WHERE voucher_id = ? AND employee_user_id = ?
       FOR UPDATE`,
      [req.params.id, req.user.userId]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Voucher not found."
      });
    }

    if (rows[0].status !== "Draft") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Only Draft vouchers can be deleted."
      });
    }

    const signaturePath = rows[0].employee_signature_path;

    await connection.execute(
      `DELETE FROM vouchers
       WHERE voucher_id = ? AND employee_user_id = ?`,
      [req.params.id, req.user.userId]
    );

    await connection.commit();
    removeStoredUpload(signaturePath);

    return res.json({
      success: true,
      message: "Draft voucher deleted successfully."
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Delete voucher error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete voucher."
    });
  } finally {
    if (connection) connection.release();
  }
}

// EMPLOYEE: UPLOAD SIGNATURE
async function uploadEmployeeSignature(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please upload a PNG or JPEG signature image."
    });
  }

  try {
    if (!validateUploadedSignature(req.file.path)) {
      removeStoredUpload(`uploads/${req.file.filename}`);

      return res.status(400).json({
        success: false,
        message: "The uploaded file is not a valid PNG or JPEG image."
      });
    }
  } catch (error) {
    removeStoredUpload(`uploads/${req.file.filename}`);
    console.error("Employee signature validation error:", error);

    return res.status(400).json({
      success: false,
      message: "Unable to validate the uploaded signature image."
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT voucher_id, status, employee_signature_path
       FROM vouchers
       WHERE voucher_id = ? AND employee_user_id = ?
       FOR UPDATE`,
      [req.params.id, req.user.userId]
    );

    if (!rows.length || rows[0].status !== "Draft") {
      await connection.rollback();
      removeStoredUpload(`uploads/${req.file.filename}`);

      return res.status(409).json({
        success: false,
        message: "Signature can only be uploaded to your Draft voucher."
      });
    }

    const oldSignature = rows[0].employee_signature_path;
    const signaturePath = `uploads/${req.file.filename}`;

    await connection.execute(
      `UPDATE vouchers
       SET employee_signature_path = ?
       WHERE voucher_id = ?`,
      [signaturePath, req.params.id]
    );

    await logActivity(
      connection,
      req.params.id,
      req.user.userId,
      "Employee Signature Uploaded",
      "Employee signature uploaded."
    );

    await connection.commit();

    if (oldSignature) removeStoredUpload(oldSignature);

    return res.json({
      success: true,
      message: "Employee signature uploaded successfully.",
      signature_path: signaturePath
    });
  } catch (error) {
    if (connection) await connection.rollback();

    removeStoredUpload(`uploads/${req.file.filename}`);
    console.error("Employee signature upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to upload employee signature."
    });
  } finally {
    if (connection) connection.release();
  }
}

// EMPLOYEE: SUBMIT FOR APPROVAL
async function submitVoucher(req, res) {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT *
       FROM vouchers
       WHERE voucher_id = ? AND employee_user_id = ?
       FOR UPDATE`,
      [req.params.id, req.user.userId]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Voucher not found."
      });
    }

    const voucher = rows[0];

    if (voucher.status !== "Draft") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Only Draft vouchers can be submitted."
      });
    }

    if (
      !voucher.voucher_date ||
      !voucher.expense_date ||
      !voucher.department ||
      !voucher.title ||
      !voucher.category ||
      !voucher.description ||
      !Number.isFinite(Number(voucher.amount)) ||
      Number(voucher.amount) <= 0
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Complete all required fields before submitting."
      });
    }

    if (!voucher.employee_signature_path) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Upload your signature before submitting."
      });
    }

    await connection.execute(
      `UPDATE vouchers
       SET status = 'Pending Approval', submitted_at = NOW()
       WHERE voucher_id = ?`,
      [req.params.id]
    );

    await logActivity(
      connection,
      req.params.id,
      req.user.userId,
      "Voucher Submitted",
      "Voucher submitted for Director approval."
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Voucher submitted for approval successfully."
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Submit voucher error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to submit voucher."
    });
  } finally {
    if (connection) connection.release();
  }
}

// DIRECTOR: GET PENDING VOUCHERS
async function getPendingVouchers(req, res) {
  try {
    const [vouchers] = await pool.execute(
      `SELECT *
       FROM vouchers
       WHERE status = 'Pending Approval'
       ORDER BY submitted_at ASC, voucher_id ASC`
    );

    return res.json({ success: true, vouchers });
  } catch (error) {
    console.error("Get pending vouchers error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve pending vouchers."
    });
  }
}

// DIRECTOR: DASHBOARD SUMMARY
async function getDirectorDashboardSummary(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS total_vouchers,
         COALESCE(SUM(status = 'Pending Approval'), 0) AS pending_vouchers,
         COALESCE(SUM(status = 'Approved'), 0) AS approved_vouchers,
         COALESCE(SUM(status = 'Rejected'), 0) AS rejected_vouchers,
         COALESCE(
           SUM(
             CASE
               WHEN status = 'Pending Approval' THEN amount
               ELSE 0
             END
           ),
           0
         ) AS total_pending_amount,
         COALESCE(
           SUM(
             CASE
               WHEN status = 'Approved'
                AND approved_at >= CURDATE()
                AND approved_at < CURDATE() + INTERVAL 1 DAY
               THEN 1
               ELSE 0
             END
           ),
           0
         ) AS approved_today,
         COALESCE(
           SUM(
             CASE
               WHEN status = 'Rejected'
                AND rejected_at >= CURDATE()
                AND rejected_at < CURDATE() + INTERVAL 1 DAY
               THEN 1
               ELSE 0
             END
           ),
           0
         ) AS rejected_today
       FROM vouchers`
    );

    return res.status(200).json({
      success: true,
      message: "Director dashboard summary retrieved successfully.",
      summary: rows[0]
    });
  } catch (error) {
    console.error("Director dashboard summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve Director dashboard summary."
    });
  }
}

// DIRECTOR: GET RECENT ACTIVITY ACROSS ALL VOUCHERS
async function getDirectorRecentActivity(req, res) {
  try {
    const [activities] = await pool.execute(
      `SELECT
         va.activity_id,
         va.voucher_id,
         v.voucher_number,
         v.title AS voucher_title,
         va.action,
         va.details,
         va.created_at,
         u.full_name AS actor_name,
         u.role AS actor_role
       FROM voucher_activity va
       LEFT JOIN vouchers v
         ON v.voucher_id = va.voucher_id
       LEFT JOIN users u
         ON u.user_id = va.actor_user_id
       ORDER BY va.created_at DESC, va.activity_id DESC
       LIMIT 10`
    );

    return res.status(200).json({
      success: true,
      activities
    });
  } catch (error) {
    console.error("Director recent activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve recent activity."
    });
  }
}
// DIRECTOR: UPLOAD SIGNATURE
async function uploadDirectorSignature(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please upload a PNG or JPEG signature image."
    });
  }

  try {
    if (!validateUploadedSignature(req.file.path)) {
      removeStoredUpload(`uploads/${req.file.filename}`);

      return res.status(400).json({
        success: false,
        message: "The uploaded file is not a valid PNG or JPEG image."
      });
    }
  } catch (error) {
    removeStoredUpload(`uploads/${req.file.filename}`);
    console.error("Director signature validation error:", error);

    return res.status(400).json({
      success: false,
      message: "Unable to validate the uploaded signature image."
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [directors] = await connection.execute(
      `SELECT user_id
       FROM users
       WHERE user_id = ? AND role = 'Director' AND is_active = 1`,
      [req.user.userId]
    );

    if (!directors.length) {
      await connection.rollback();
      removeStoredUpload(`uploads/${req.file.filename}`);

      return res.status(403).json({
        success: false,
        message: "An active Director account is required."
      });
    }

    const [rows] = await connection.execute(
      `SELECT voucher_id, status, director_signature_path
       FROM vouchers
       WHERE voucher_id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length || rows[0].status !== "Pending Approval") {
      await connection.rollback();
      removeStoredUpload(`uploads/${req.file.filename}`);

      return res.status(409).json({
        success: false,
        message: "A Director signature can only be uploaded for a pending voucher."
      });
    }

    const oldSignature = rows[0].director_signature_path;
    const signaturePath = `uploads/${req.file.filename}`;

    await connection.execute(
      `UPDATE vouchers
       SET director_signature_path = ?
       WHERE voucher_id = ?`,
      [signaturePath, req.params.id]
    );

    await logActivity(
      connection,
      req.params.id,
      req.user.userId,
      "Director Signature Uploaded",
      "Director signature uploaded."
    );

    await connection.commit();

    if (oldSignature) removeStoredUpload(oldSignature);

    return res.json({
      success: true,
      message: "Director signature uploaded and saved successfully.",
      signature_path: signaturePath
    });
  } catch (error) {
    if (connection) await connection.rollback();

    removeStoredUpload(`uploads/${req.file.filename}`);
    console.error("Director signature upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to upload Director signature."
    });
  } finally {
    if (connection) connection.release();
  }
}

// DIRECTOR: APPROVE VOUCHER
async function approveVoucher(req, res) {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [directors] = await connection.execute(
      `SELECT user_id
       FROM users
       WHERE user_id = ? AND role = 'Director' AND is_active = 1`,
      [req.user.userId]
    );

    if (!directors.length) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "An active Director account is required."
      });
    }

    const [rows] = await connection.execute(
      `SELECT voucher_id, status, director_signature_path
       FROM vouchers
       WHERE voucher_id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Voucher not found."
      });
    }

    if (rows[0].status !== "Pending Approval") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Only pending vouchers can be approved."
      });
    }

    if (!rows[0].director_signature_path) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Upload the Director signature before approving."
      });
    }

    await connection.execute(
      `UPDATE vouchers
       SET status = 'Approved',
           approved_by = ?,
           approved_at = NOW(),
           rejected_by = NULL,
           rejected_at = NULL,
           rejection_reason = NULL
       WHERE voucher_id = ?`,
      [req.user.userId, req.params.id]
    );

    await logActivity(
      connection,
      req.params.id,
      req.user.userId,
      "Voucher Approved",
      "Director approved the voucher."
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Voucher approved successfully."
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Approve voucher error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to approve voucher."
    });
  } finally {
    if (connection) connection.release();
  }
}

// DIRECTOR: REJECT VOUCHER
async function rejectVoucher(req, res) {
  const reason =
    typeof req.body.reason === "string"
      ? req.body.reason.trim()
      : "";

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: "A rejection reason is required."
    });
  }

  if (reason.length > 2000) {
    return res.status(400).json({
      success: false,
      message: "The rejection reason cannot exceed 2000 characters."
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [directors] = await connection.execute(
      `SELECT user_id
       FROM users
       WHERE user_id = ? AND role = 'Director' AND is_active = 1`,
      [req.user.userId]
    );

    if (!directors.length) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "An active Director account is required."
      });
    }

    const [rows] = await connection.execute(
      `SELECT voucher_id, status
       FROM vouchers
       WHERE voucher_id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Voucher not found."
      });
    }

    if (rows[0].status !== "Pending Approval") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Only pending vouchers can be rejected."
      });
    }

    await connection.execute(
      `UPDATE vouchers
       SET status = 'Rejected',
           rejected_by = ?,
           rejected_at = NOW(),
           rejection_reason = ?,
           approved_by = NULL,
           approved_at = NULL
       WHERE voucher_id = ?`,
      [req.user.userId, reason, req.params.id]
    );

    await logActivity(
      connection,
      req.params.id,
      req.user.userId,
      "Voucher Rejected",
      reason
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Voucher rejected successfully."
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Reject voucher error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reject voucher."
    });
  } finally {
    if (connection) connection.release();
  }
}
// ACCOUNTS: READ-ONLY ACCESS TO ALL VOUCHERS
async function getAllVouchersForAccounts(req, res) {
  try {
    const { status, search, sortBy, order } = req.query;

    const allowedStatuses = [
      "Draft",
      "Pending Approval",
      "Approved",
      "Rejected"
    ];

    const allowedSortColumns = {
      voucher_date: "v.voucher_date",
      expense_date: "v.expense_date",
      amount: "v.amount",
      status: "v.status",
      created_at: "v.created_at",
      voucher_number: "v.voucher_number",
      employee_name: "v.employee_name"
    };

    const conditions = [];
    const params = [];

    if (status && status !== "All") {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid voucher status filter."
        });
      }

      conditions.push("v.status = ?");
      params.push(status);
    }

    if (typeof search === "string" && search.trim()) {
      const searchValue = `%${search.trim()}%`;

      conditions.push(`(
        v.voucher_number LIKE ?
        OR v.employee_name LIKE ?
        OR v.employee_code LIKE ?
        OR v.department LIKE ?
        OR v.title LIKE ?
        OR v.category LIKE ?
      )`);

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    const sortColumn =
      allowedSortColumns[sortBy] || "v.created_at";

    const sortOrder =
      String(order).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [vouchers] = await pool.execute(
      `SELECT
         v.voucher_id,
         v.voucher_number,
         v.employee_user_id,
         v.employee_name,
         v.employee_code,
         v.voucher_date,
         v.expense_date,
         v.department,
         v.title,
         v.category,
         v.description,
         v.amount,
         v.employee_signature_path,
         v.director_signature_path,
         v.status,
         v.submitted_at,
         v.approved_by,
         approver.full_name AS approved_by_name,
         v.approved_at,
         v.rejected_by,
         rejector.full_name AS rejected_by_name,
         v.rejected_at,
         v.rejection_reason,
         v.created_at,
         v.updated_at
       FROM vouchers v
       LEFT JOIN users approver
         ON approver.user_id = v.approved_by
       LEFT JOIN users rejector
         ON rejector.user_id = v.rejected_by
       ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder}, v.voucher_id DESC`,
      params
    );

    return res.json({
      success: true,
      count: vouchers.length,
      vouchers
    });
  } catch (error) {
    console.error("Get all vouchers for Accounts error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve vouchers for Accounts."
    });
  }
}

// EMPLOYEE: DASHBOARD SUMMARY
async function getEmployeeDashboardSummary(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS total_vouchers,
         COALESCE(SUM(status = 'Draft'), 0) AS draft_vouchers,
         COALESCE(SUM(status = 'Pending Approval'), 0) AS pending_vouchers,
         COALESCE(SUM(status = 'Approved'), 0) AS approved_vouchers,
         COALESCE(SUM(status = 'Rejected'), 0) AS rejected_vouchers,
         COALESCE(SUM(amount), 0) AS total_amount_claimed
       FROM vouchers
       WHERE employee_user_id = ?`,
      [req.user.userId]
    );

    return res.status(200).json({
      success: true,
      message: "Employee dashboard summary retrieved successfully.",
      summary: rows[0]
    });
  } catch (error) {
    console.error("Employee dashboard summary error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve employee dashboard summary."
    });
  }
}

// AUTHENTICATED: SERVE A SIGNATURE IMAGE WITH ACCESS CONTROL
async function getVoucherSignature(req, res) {
  const filename = req.params.filename;

  // Only accept signature filenames generated by the upload middleware.
  if (
    typeof filename !== "string" ||
    filename !== path.basename(filename) ||
    !/^signature-\d+-\d+\.(png|jpe?g)$/i.test(filename)
  ) {
    return res.status(404).json({
      success: false,
      message: "Signature not found."
    });
  }

  const relativePath = `uploads/${filename}`;

  try {
    const [users] = await pool.execute(
      `SELECT user_id, role, is_active
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [req.user.userId]
    );

    if (
      !users.length ||
      Number(users[0].is_active) !== 1 ||
      !["Employee", "Director", "Accounts"].includes(users[0].role)
    ) {
      return res.status(404).json({
        success: false,
        message: "Signature not found."
      });
    }

    const user = users[0];

    let sql = `
      SELECT
        voucher_id,
        employee_user_id,
        employee_signature_path,
        director_signature_path
      FROM vouchers
      WHERE (
        employee_signature_path = ?
        OR director_signature_path = ?
      )
    `;
    const values = [relativePath, relativePath];

    // Employees may view signatures only on their own vouchers.
    if (user.role === "Employee") {
      sql += " AND employee_user_id = ?";
      values.push(user.user_id);
    }

    sql += " LIMIT 1";

    const [vouchers] = await pool.execute(sql, values);

    if (!vouchers.length) {
      return res.status(404).json({
        success: false,
        message: "Signature not found."
      });
    }

    const uploadsDirectory = path.resolve(__dirname, "..", "uploads");
    const absolutePath = path.resolve(uploadsDirectory, filename);

    if (!absolutePath.startsWith(uploadsDirectory + path.sep)) {
      return res.status(404).json({
        success: false,
        message: "Signature not found."
      });
    }

    let stats;
    try {
      stats = fs.statSync(absolutePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        return res.status(404).json({
          success: false,
          message: "Signature not found."
        });
      }
      throw error;
    }

    if (!stats.isFile() || !validateUploadedSignature(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "Signature not found."
      });
    }

    const extension = path.extname(filename).toLowerCase();

    res.setHeader(
      "Content-Type",
      extension === ".png" ? "image/png" : "image/jpeg"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");

    return res.sendFile(absolutePath, (error) => {
      if (error && !res.headersSent) {
        console.error("Signature response error:", error.message);

        res.status(500).json({
          success: false,
          message: "Unable to retrieve signature."
        });
      }
    });
  } catch (error) {
    console.error("Get voucher signature error:", error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Unable to retrieve signature."
      });
    }
  }
}

// EXPORT CONTROLLERS
module.exports = {
  // Employee
  createVoucher,
  getMyVouchers,
  getMyVoucherById,
  getVoucherActivity,
  updateVoucher,
  deleteVoucher,
  uploadEmployeeSignature,
  submitVoucher,
  getEmployeeDashboardSummary,
  getVoucherSignature,

  // Director
  getPendingVouchers,
  getDirectorDashboardSummary,
  getDirectorRecentActivity,
  uploadDirectorSignature,
  approveVoucher,
  rejectVoucher,

  // Accounts
  getAllVouchersForAccounts
};