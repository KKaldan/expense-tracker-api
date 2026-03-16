# AI Development Context

You are acting as a senior backend engineer assisting with the development of this project.

Your responsibilities include:
- Reviewing architecture
- Suggesting improvements
- Designing features before implementation
- Maintaining code quality and consistency
- Ensuring secure backend practices

---

# Project

SaaS-style Expense Tracker backend API.

The goal of the project is to build a production-style backend system that allows users to:

- Create accounts
- Log in securely
- Track personal expenses
- Manage financial data
- View reports and analytics

The project is being developed as a portfolio project demonstrating backend engineering skills.

---

# Tech Stack

Backend Runtime
- Node.js

Web Framework
- Express

Database
- PostgreSQL

Authentication
- JWT (JSON Web Tokens)

Security
- bcrypt password hashing

Validation
- Zod (planned)

API Testing
- Postman

Version Control
- Git / GitHub

---

# Architecture

The project follows a layered architecture.

routes → controllers → services → repositories → database

Responsibilities:

Routes  
Define API endpoints and attach middleware.

Controllers  
Handle HTTP request and response logic.

Services  
Contain business logic.

Repositories  
Contain database queries.

Database  
PostgreSQL relational database.

---

# Folder Structure

src/

config  
Database connection

middleware  
Authentication middleware

modules  
Feature modules (auth, expenses)

utils  
Shared utilities such as error handling

app.js  
Express app configuration

server.js  
Application entry point

---

# Modules Implemented

## Auth Module

Endpoints:

POST /api/v1/auth/register  
POST /api/v1/auth/login  
GET /api/v1/auth/me  

Features:

User registration  
Password hashing  
JWT authentication  
Protected routes

---

## Expense Module

Endpoints:

POST /api/v1/expenses  
GET /api/v1/expenses  
DELETE /api/v1/expenses/:id  

Features:

Create expense  
List user expenses  
Delete expense  

Expenses belong to authenticated users.

---

# Database

Current tables:

users  
expenses

Relationship:

expenses.user_id → users.id

Each expense belongs to a specific user.

---

# Coding Principles

Maintain the layered architecture.

Controllers should not contain business logic.

Services should handle business logic.

Repositories should contain SQL queries only.

Follow REST API design conventions.

All protected routes must require authentication middleware.

---

# Current Development Stage

Week 1 completed.

Implemented:

User authentication system  
JWT protected routes  
Expense tracking CRUD basics  
Database schema  
Project architecture

---

# Current Priority

Week 2 improvements:

Add expense editing endpoint  
PUT /expenses/:id

Add pagination for GET /expenses

Add filtering by category

Add filtering by date range

Add request validation using Zod

Improve error handling

---

# Long Term Goals

Categories system

Budgets system

Expense analytics and reporting

Dashboard-ready endpoints

Possible frontend integration (React)

Deployment and production readiness