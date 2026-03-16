# Backend Architecture

This project follows a layered backend architecture commonly used in production APIs.

The goal of this architecture is to separate responsibilities and keep the codebase maintainable.

---

# Request Flow

Client Request

↓

Route

↓

Controller

↓

Service

↓

Repository

↓

Database

↓

Response

---

# Layer Responsibilities

## Routes

Routes define API endpoints and attach middleware.

Example:

POST /auth/register  
GET /expenses  

Routes should not contain business logic.

---

## Controllers

Controllers handle HTTP request and response handling.

Responsibilities:

- Read request data
- Call service functions
- Return JSON responses

Controllers should not contain database queries.

---

## Services

Services contain business logic.

Examples:

- Hashing passwords
- Checking for duplicate users
- Applying business rules
- Preparing data for repositories

Services should not directly handle HTTP responses.

---

## Repositories

Repositories interact with the database.

Responsibilities:

- Execute SQL queries
- Return database results

Repositories should not contain business logic.

---

# Database

The project uses PostgreSQL as the relational database.

Current tables:

users  
expenses

Users table stores account information.

Expenses table stores financial data belonging to users.

Each expense references a user through a foreign key.

---

# Authentication System

Authentication is implemented using JWT.

Process:

User logs in

↓

Server verifies credentials

↓

Server generates JWT token

↓

Client sends token with requests

↓

Authentication middleware verifies token

↓

Request proceeds if token is valid

---

# Middleware

Middleware is used for request preprocessing.

Current middleware:

auth.middleware.js

Responsibilities:

- Extract JWT token from Authorization header
- Verify token
- Attach user information to request object

---

# Error Handling

Custom error utilities are used to standardize error responses.

Example:

AppError class

This allows the application to return structured error messages.

---

# Future Architecture Expansion

Planned modules:

categories  
budgets  
reports  
analytics

These modules will follow the same architecture pattern.

routes → controllers → services → repositories