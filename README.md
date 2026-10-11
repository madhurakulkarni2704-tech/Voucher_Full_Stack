# Expense Voucher Management System

A full-stack web application developed for **Prachay Securities Private Limited** to manage expense vouchers digitally, simplify approval workflows, and maintain voucher activity records.

## Features

- User authentication with role-based access
- Expense voucher management
- Voucher approval workflow
- Activity tracking and audit history
- MySQL database integration
- React-based frontend
- Node.js and Express backend

## Technology Stack

- **Frontend:** React, Vite, CSS
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Authentication:** JWT
- **Version Control:** Git and GitHub

## Project Structure

Voucher_Full_Stack/
├── backend/
├── frontend/
├── database/
├── .gitignore
└── README.md

## Getting Started

### 1. Clone the repository

git clone https://github.com/madhurakulkarni2704-tech/Voucher_Full_Stack.git
cd Voucher_Full_Stack


### 2. Set up the database

- Start your MySQL server.
- Create the database `expense_voucher_db`.
- Review the SQL files in the `database/` folder and import the appropriate schema and data files in the required order.

### 3. Configure the backend

- Open the `backend/` folder.
- Install dependencies using `npm install`.
- Create your local `.env` file using `.env.example` as a reference.
- Fill in your own database credentials, JWT secret, and required application settings.

**Never commit your actual `.env` file or private credentials.**

### 4. Run the backend

Follow the backend scripts and configuration in `backend/package.json` to start the server.

### 5. Run the frontend

- Open a separate terminal in the `frontend/` folder.
- Run `npm install`.
- Run `npm run dev`.
- Open the local URL displayed in the terminal.

## Security

- Keep database passwords and JWT secrets private.
- Use strong credentials for privileged accounts.
- Do not commit private uploads or confidential business information.

## Purpose

This project demonstrates full-stack web development, database integration, authentication, and expense voucher workflow management.
