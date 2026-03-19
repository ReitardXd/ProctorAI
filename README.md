# ProctorAI — AI-Powered University Examination Portal

![Sprint](https://img.shields.io/badge/Sprint-3-blue) ![Status](https://img.shields.io/badge/Status-Complete-green) ![Stack](https://img.shields.io/badge/Stack-Node.js%20%7C%20PostgreSQL%20%7C%20Vanilla%20JS-navy)

---

## Course Information

| Field | Details |
|---|---|
| Course | Software Engineering and Project Management |
| Course Code | 21CSC303J |
| Institution | SRM Institute of Science and Technology |
| Programme | B.Tech CSE — Computer Networking |
| Batch | 2023–2027 |
| Semester | 6th Semester (3rd Year) |

---

## Team

| Name | Role |
|---|---|
| Pranav | Full Stack Development — Backend, Frontend, Database, DevOps |
| Devang | Scrum Master |
| Parth | ProductOwner |

---

## What is ProctorAI?

ProctorAI is a web-based AI exam proctoring and management system built as part of the Software Engineering and Project Management course project. It allows students to take secure, monitored online exams while administrators oversee live sessions, review flagged incidents, and manage student data — all through a role-separated, authenticated interface.

The system implements real webcam-based monitoring using the browser's `getUserMedia` API, captures live video during exams, stores encrypted submissions in a PostgreSQL database, and provides an admin dashboard for incident management.

---

## Demo Video

The demo recording covers all Sprint 3 user stories end to end:

- **US2** — Web-based access: app runs in any standard browser, no plugins required
- **US3** — Secure login: bcrypt-hashed passwords, server-side sessions, role-based routing
- **US4** — Webcam & mic access: live camera feed during exam, browser permission prompt
- **US1** — Secure exam data storage: AES-encrypted answers verified in the database

---

## Sprint 3 — User Stories

| ID | Title | Priority | Tasks | Status |
|---|---|---|---|---|
| US1 | Secure Exam Data Storage | Must Have | 4 / 4 | ✅ Complete |
| US2 | Web-Based Access | Must Have | 2 / 2 | ✅ Complete |
| US3 | Secure Login | Must Have | 4 / 4 | ✅ Complete |
| US4 | Webcam & Mic Access | Must Have | 4 / 4 | ✅ Complete |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js v22 | Server-side JavaScript |
| Framework | Express v5 | HTTP server and API routing |
| Database | PostgreSQL 18 | Relational data storage |
| Sessions | express-session | Server-side session management |
| Session Store | connect-pg-simple | Persist sessions in PostgreSQL |
| Password Security | bcrypt (cost 12) | One-way password hashing |
| Data Encryption | crypto-js AES | Encrypt exam answers at rest |
| Rate Limiting | express-rate-limit | Brute-force protection on login |
| Webcam | getUserMedia API | Live webcam stream during exam |
| Frontend | Vanilla HTML/CSS/JS | Single-file SPA, no frameworks |
| Dev Server | live-server | Frontend development server |

---

## Project Structure

```
ProctorProject/
  backend/
    server.js                 # Express app, middleware, route registration
    db.js                     # PostgreSQL connection pool
    .env                      # Secrets — never committed to git
    seed.js                   # Creates demo users in the database
    routes/
      auth.js                 # POST /api/auth/login, POST /api/auth/logout
      exam.js                 # POST /api/exam/submit, GET /api/exam/submissions
    middleware/
      authenticate.js         # Session check + role guard middleware
    utils/
      encrypt.js              # AES encrypt / decrypt helpers
  Frontend/
    proctor.html              # Entire frontend — routing, state, UI in one file
  package.json
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Student and admin accounts with bcrypt-hashed passwords |
| `exams` | Exam definitions — title, duration |
| `exam_submissions` | Student answers stored AES-encrypted |
| `incidents` | AI-flagged proctoring violations per student |
| `user_sessions` | Active sessions stored server-side in PostgreSQL |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login with username + password |
| POST | `/api/auth/logout` | Session | Destroy session and clear cookie |
| POST | `/api/exam/submit` | Student | Submit encrypted exam answers |
| GET | `/api/exam/submissions` | Admin | Fetch all submissions |

---

## Security Implementation

- **Passwords** — bcrypt hashed with cost factor 12, never stored in plaintext
- **Exam answers** — AES encrypted before INSERT, unreadable without the key
- **Sessions** — stored server-side in PostgreSQL with httpOnly cookies
- **Route protection** — every endpoint checks session validity and user role
- **Rate limiting** — login limited to 10 attempts per 15 minutes
- **CORS** — only the known frontend origin is permitted
- **Secrets** — all keys and connection strings in `.env`, never hardcoded

---

## How to Run Locally

**Prerequisites:** Node.js v18+, PostgreSQL, npm, live-server

```bash
# 1. Start PostgreSQL
sudo systemctl start postgresql

# 2. Install dependencies
cd ~/Projects/Proctorproject
npm install

# 3. Start backend — Terminal 1
node backend/server.js
# → Server running on port 3000

# 4. Start frontend — Terminal 2
live-server Frontend/
# → http://127.0.0.1:8080/proctor.html
```

### Demo Credentials

| Role | Username | Password | Redirects To |
|---|---|---|---|
| Student | `student` | `student123` | Exam page with webcam |
| Admin | `admin` | `admin123` | Admin dashboard |

---

## Frontend Architecture

The entire frontend is a single HTML file with no external frameworks. It implements:

| Module | Description |
|---|---|
| `Router` | `navigate(page)` with role guards — students blocked from admin pages |
| `State` | Single state object — user, exam progress, webcam stream |
| `Auth` | `login()` and `logout()` via fetch to backend API |
| `ExamController` | Timer, questions, answer tracking, auto-submit on timeout |
| `AdminUI` | Dashboard, live monitoring grid, incident report view |
| `Modal` | Reusable alert/confirm system for warnings and submit confirmation |
| `startWebcam()` | `getUserMedia` — requests permission, streams live feed to proctor panel |

---

## Key Features

- Role-based navigation — student and admin flows completely separated
- Live webcam feed shown in proctor panel during exam
- Browser permission prompt for camera and mic before exam starts
- Countdown timer with auto-submit when time expires
- Submit confirmation modal showing answered vs unanswered questions
- Suspicious behavior alerts fired during exam session
- AES-encrypted exam submissions verified in database
- Admin dashboard with incident logs, live monitoring, and violation details

---

*ProctorAI — 21CSC303J Software Engineering and Project Management — SRM IST — 2026*
