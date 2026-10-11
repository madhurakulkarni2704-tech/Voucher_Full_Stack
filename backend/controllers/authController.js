
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const validRoles = ["Employee", "Director", "Accounts"];

// Create an employee account.
// Public registration cannot assign Director or Accounts roles.
const register = async (req, res) => {
  try {
    const { full_name, employee_code, email, password, department } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required.",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [existingUsers] = await pool.execute(
      "SELECT user_id FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
      `INSERT INTO users
       (full_name, employee_code, email, password_hash, department, role)
       VALUES (?, ?, ?, ?, ?, 'Employee')`,
      [
        full_name.trim(),
        employee_code?.trim() || null,
        normalizedEmail,
        passwordHash,
        department?.trim() || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Employee account created successfully.",
      user: {
        user_id: result.insertId,
        full_name: full_name.trim(),
        email: normalizedEmail,
        role: "Employee",
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email or employee code already exists.",
      });
    }

    console.error("Registration error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to create account.",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [users] = await pool.execute(
      `SELECT user_id, full_name, employee_code, email,
              password_hash, department, role, is_active
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!validRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "This account has an invalid role.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from the environment.");
      return res.status(500).json({
        success: false,
        message: "Authentication is not configured.",
      });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        employee_code: user.employee_code,
        email: user.email,
        department: user.department,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to log in.",
    });
  }
};

const getMe = async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT user_id, full_name, employee_code, email, department, role
       FROM users
       WHERE user_id = ? AND is_active = TRUE`,
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User account not found or inactive.",
      });
    }

    return res.json({
      success: true,
      user: users[0],
    });
  } catch (error) {
    console.error("Get user error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve user information.",
    });
  }
};

module.exports = { register, login, getMe };
