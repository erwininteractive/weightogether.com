# WeighTogether - Technical Requirements

**Version:** 2.0
**Last Updated:** 2025-12-04

---

## 1. Executive Summary

### 1.1. Project Overview

A simple, server-rendered weight loss tracking application. The platform enables users to register, log in, and track their weight over time through a dashboard interface.

### 1.2. Core Objectives

- Provide a straightforward user authentication system.
- Allow users to log and view their weight entries.
- Present weight history in a clear, easy-to-understand dashboard.
- Use a modern, maintainable, and simple technology stack.

---

## 2. System Architecture

### 2.1. Architecture Style

A monolithic server-side rendered (SSR) application using a Model-View-Controller (MVC) pattern.

- **Web Server:** A single Node.js application built with the Express framework.
- **Database:** A PostgreSQL database for data persistence.
- **View Rendering:** EJS (Embedded JavaScript) templates are used to render HTML on the server.
- **Styling:** Tailwind CSS is used for styling, processed by Vite.

### 2.2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                     Web Browser                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Server                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                Node.js + Express App                 │   │
│  │   - Serves HTML pages (EJS Templates)                │   │
│  │   - Handles user authentication                      │   │
│  │   - Provides API endpoints for dashboard data        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Server                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 PostgreSQL Database                  │   │
│  │   - Stores user data, weight entries, etc.           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1. Backend

- **Runtime:** Node.js 20.x
- **Framework:** Express 4.x
- **Language:** TypeScript 5.x
- **ORM:** Prisma 7.x
- **Authentication:** JWT (JSON Web Tokens) using `jsonwebtoken` and `cookie-parser`.
- **Password Hashing:** `bcrypt`
- **Validation:** `express-validator`

### 3.2. Frontend

- **View Engine:** EJS (Embedded JavaScript) with `express-ejs-layouts`.
- **Styling:** Tailwind CSS 4.x
- **CSS Build Tool:** Vite 7.x

### 3.3. Database

- **Database:** PostgreSQL 16.x
- **Driver:** `pg`

### 3.4. Development

- **Dev Server:** `nodemon` for automatic server restarts.
- **TypeScript Runner:** `ts-node`
- **Linting:** ESLint with `@typescript-eslint/parser`.
- **Formatting:** Prettier
- **Containerization:** Docker and Docker Compose.

---

## 4. Dependencies

### 4.1. Production Dependencies

- `@prisma/adapter-pg`: Prisma adapter for PostgreSQL.
- `@prisma/client`: Prisma's auto-generated database client.
- `@tailwindcss/vite`: Tailwind CSS plugin for Vite.
- `bcrypt`: Library for hashing passwords.
- `cookie-parser`: Middleware to parse cookies.
- `dotenv`: Loads environment variables from a `.env` file.
- `ejs`: Embedded JavaScript templating.
- `express`: Web framework for Node.js.
- `express-ejs-layouts`: Layout support for EJS.
- `express-validator`: Middleware for input validation.
- `jsonwebtoken`: Implementation of JSON Web Tokens.
- `pg`: PostgreSQL client for Node.js.
- `prisma`: The Prisma CLI.

### 4.2. Development Dependencies

- `@types/*`: Type definitions for various libraries.
- `@typescript-eslint/eslint-plugin`: ESLint plugin for TypeScript.
- `@typescript-eslint/parser`: Parser for ESLint to support TypeScript.
- `eslint`: Linter for identifying and reporting on patterns in JavaScript.
- `nodemon`: Monitors for any changes in your source and automatically restarts your server.
- `prettier`: Code formatter.
- `tailwindcss`: A utility-first CSS framework.
- `ts-node`: TypeScript execution environment for Node.js.
- `typescript`: Superset of JavaScript that compiles to plain JavaScript.
- `vite`: Frontend build tool.

---

## 5. Infrastructure & Deployment

- **Containerization:** The application is containerized using Docker for both development and production environments.
- **Development:** A `docker-compose.yml` file is provided to set up the application, a PostgreSQL database, and Prisma Studio.
- **Production:** A `docker-compose.prod.yml` and `Dockerfile` are provided for building and running the application in a production environment.
