
require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../config/db");

async function createPrivilegedUsers() {
  const users = [
    {
      full_name: process.env.DIRECTOR_NAME,
      email: process.env.DIRECTOR_EMAIL,
      password: process.env.DIRECTOR_PASSWORD,
      employee_code: process.env.DIRECTOR_CODE,
      department: process.env.DIRECTOR_DEPARTMENT || "Management",
      role: "Director",
    },
    {
      full_name: process.env.ACCOUNTS_NAME,
      email: process.env.ACCOUNTS_EMAIL,
      password: process.env.ACCOUNTS_PASSWORD,
      employee_code: process.env.ACCOUNTS_CODE,
      department: process.env.ACCOUNTS_DEPARTMENT || "Accounts",
      role: "Accounts",
    },
  ];

  const connection = await pool.getConnection();

  try {
    for (const user of users) {
      if (
        !user.full_name ||
        !user.email ||
        !user.password ||
        !user.employee_code
      ) {
        throw new Error(
          `Missing required setup values for ${user.role}. Check your temporary .env settings.`
        );
      }

      if (user.password.length < 12) {
        throw new Error(
          `${user.role} password must contain at least 12 characters.`
        );
      }

      const [existing] = await connection.execute(
        "SELECT user_id FROM users WHERE email = ? OR employee_code = ?",
        [user.email.trim().toLowerCase(), user.employee_code]
      );

      if (existing.length > 0) {
        throw new Error(
          `Email or employee code already exists for ${user.role}. No accounts were created by this script run.`
        );
      }
    }

    await connection.beginTransaction();

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 12);

      await connection.execute(
        `INSERT INTO users
         (full_name, employee_code, email, password_hash, department, role)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user.full_name.trim(),
          user.employee_code.trim(),
          user.email.trim().toLowerCase(),
          passwordHash,
          user.department.trim(),
          user.role,
        ]
      );

      console.log(`${user.role} account created successfully.`);
    }

    await connection.commit();
    console.log("Privileged account setup completed.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

createPrivilegedUsers().catch((error) => {
  console.error("Account setup failed:", error.message);
  process.exitCode = 1;
});
