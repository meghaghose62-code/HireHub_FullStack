# 🏢 HireHub — Recruitment Management System

> A full-stack Recruitment Management System (RMS) built with Node.js, Express.js, Prisma ORM, PostgreSQL, and a Vanilla HTML/CSS/JavaScript frontend.

---

## ✨ Features

- 👤 **Role-Based Access**
  - Admin
  - Recruiter
  - Candidate

- 💼 **Job Posting & Approval**
  - Recruiters can create and manage job postings.
  - Admins can approve or reject job postings.
  - Approved jobs become available to candidates.

- 📝 **Job Applications**
  - Candidates can browse available jobs and apply.
  - Recruiters can view and manage applications.
  - Application status can be tracked throughout the hiring process.

- 🗓️ **Interview Scheduling**
  - Recruiters can schedule interviews.
  - Candidates can view scheduled interviews.
  - Interview feedback can be recorded.

- 📊 **Reports & Analytics**
  - Dashboard statistics
  - Application reports
  - Job reports
  - User reports
  - Recruiter/candidate analytics

- 🔔 **Notifications**
  - Application-related notifications
  - Interview notifications
  - System notifications
  - Admin broadcast alerts

- ⭐ **Company Reviews**
  - Candidates can submit company reviews.
  - Users can view available company reviews.

- 📎 **Resume Upload**
  - Candidates can upload resumes.
  - Resume files are stored on the server and excluded from Git.

- 🔐 **JWT Authentication**
  - Secure login and registration.
  - JWT-based authentication for protected API endpoints.

- 🛡️ **Role-Based Authorization**
  - Backend middleware protects role-specific API routes.
  - Admin, Recruiter, and Candidate permissions are separated.

---

## 🗂️ Project Structure

```text
HireHub_FullStack/
│
├── .gitignore
├── README.md
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── dashboard.html
│   ├── admin-dashboard.html
│   ├── recruiter-dashboard.html
│   ├── jobs.html
│   ├── apply.html
│   ├── applications.html
│   ├── post-job.html
│   ├── edit-job.html
│   ├── job-approval.html
│   ├── schedule-interview.html
│   ├── interview-feedback.html
│   ├── notifications.html
│   ├── system-alerts.html
│   ├── report-analysis.html
│   ├── job-report.html
│   ├── application-report.html
│   ├── user-report.html
│   ├── company-reviews.html
│   ├── saved-jobs.html
│   ├── upload-resume.html
│   ├── manage-users.html
│   ├── view-application.html
│   │
│   ├── CSS/
│   ├── js/
│   └── images/
│
└── backend/
    ├── server.js
    ├── package.json
    ├── .env.example
    ├── .env                  # Local only - never commit
    ├── .gitignore
    │
    ├── middleware/
    │   └── auth.js
    │
    ├── routes/
    │   ├── auth.js
    │   ├── jobs.js
    │   ├── applications.js
    │   ├── interviews.js
    │   ├── resumes.js
    │   ├── notifications.js
    │   ├── reviews.js
    │   ├── reports.js
    │   └── users.js
    │
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.js
    │
    ├── tests/
    │   ├── test_runner.js
    │   └── test_workflow.js
    │
    ├── scripts/
    │   └── cleanup_db.js
    │
    └── uploads/
        └── resumes/