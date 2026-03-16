# Project Overview

This project is a backend API for a SaaS-style expense tracking application.

The system allows users to create accounts, securely authenticate, and track their personal expenses.

The project is designed to demonstrate backend engineering skills including:

API design  
Authentication systems  
Database modeling  
Backend architecture  
Security practices

---

# Core Features

User Registration

Users can create an account with email, name, and password.

Passwords are securely hashed before being stored.

---

User Authentication

Users can log in using their credentials.

The system generates a JWT token that is used to authenticate future requests.

---

Protected Routes

Certain API routes require authentication.

Requests must include a valid JWT token in the Authorization header.

---

Expense Tracking

Authenticated users can:

Create expenses  
View their expenses  
Delete expenses

Each expense belongs to a specific user.

---

# Tech Stack

Backend runtime

Node.js

Web framework

Express

Database

PostgreSQL

Authentication

JWT

Security

bcrypt password hashing

---

# Development Goals

The goal of this project is to build a production-style backend service suitable for a SaaS application.

Future features will include:

Expense editing  
Expense categories  
Budget tracking  
Financial analytics  
Dashboard endpoints

The project may eventually include a frontend interface and deployment.