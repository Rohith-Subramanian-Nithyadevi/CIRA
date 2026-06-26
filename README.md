# CIRA

CIRA is a college readiness and assessment platform. In simple terms, it helps an institution manage students, faculty, assessments, question banks, performance tracking, and AI-assisted follow-up assignments from one system.

The project is split into a few small apps that work together instead of one large application.

## What CIRA Does

CIRA is designed for three main groups:

- **Students** log in, take assessments, and view their learning progress.
- **Faculty** manage students in their departments, evaluate performance, upload questions, and review readiness data.
- **Admins** manage departments, sections, users, faculty approvals, and overall platform control.

The platform also includes an AI service that can look at weak topics and generate adaptive assignments as downloadable PDFs.

## Project Structure

```text
CIRA/
  frontend-web/       Website used by students, faculty, and admins
  desktop-client/     Secure desktop exam app
  backend-core/       Main server for users, roles, departments, exams, and analytics
  backend-ai/         AI service for readiness scoring and assignment generation
  docker-compose.yml  Local database setup
```

## How the Parts Fit Together

### 1. Web App

The `frontend-web` app is the main browser interface.

It contains:

- Landing page
- Login page
- Admin dashboard
- Faculty dashboard
- Student dashboard

After login, users are sent to the correct dashboard based on their role.

### 2. Desktop Exam Client

The `desktop-client` app is an Electron-based exam window.

It is meant for controlled exam sessions. It opens in full-screen kiosk mode and blocks common shortcuts such as copy, paste, quit, and app switching.

This is useful when assessments need a more restricted environment than a normal browser.

### 3. Core Backend

The `backend-core` service is the main brain of the system.

It handles:

- Student and faculty registration
- Login and user sessions
- Role-based access for students, faculty, and admins
- Faculty approval by admins
- Department and section management
- Faculty-to-department mapping
- Student evaluation by faculty
- Question bank upload from Excel files
- Department-level analytics

This backend uses:

- **PostgreSQL** for structured college data such as users, departments, sections, assessments, and results.
- **MongoDB** for flexible exam/question data such as question banks and generated assignments.

### 4. AI Backend

The `backend-ai` service focuses on intelligence and automation.

It handles:

- Calculating an Industry Readiness Index, or IRI
- Finding weak topics from performance data
- Matching weak topics to suitable questions
- Generating adaptive assignments
- Returning assignment PDFs for students

This service is separate from the core backend so AI-heavy work can grow independently without making the main server harder to manage.

## Data Flow in Plain English

1. A student, faculty member, or admin uses the web app.
2. The web app talks to the core backend.
3. The core backend checks who the user is and what they are allowed to do.
4. Normal records like users, departments, sections, and scores are stored in PostgreSQL.
5. Larger or more flexible exam content, such as question banks, is stored in MongoDB.
6. When AI support is needed, the AI backend reads the relevant data and returns readiness scores or assignment PDFs.
7. Faculty and admins use dashboards to review student progress and department readiness.

## Databases

The local database setup is in `docker-compose.yml`.

It starts:

- One PostgreSQL database for structured platform data
- A three-node MongoDB replica set for question bank and assignment data

MongoDB is configured as a replica set because the question import flow uses transactions. Transactions help make sure a bad spreadsheet does not partially import questions.

## Main User Roles

### Student

A student can register, log in, access the student dashboard, and be connected to a department and section.

### Faculty

A faculty member can register, but their account starts as pending. An admin must approve the faculty account before it can be used normally.

Faculty can work with assigned departments, view students, evaluate results, and upload question banks.

### Admin

An admin controls the system setup.

Admins can approve faculty, manage users, create departments and sections, and view broader analytics.

## Question Bank Import

Faculty and admins can upload questions using an Excel file.

The system checks every row before saving anything. If one row is invalid, the import is rejected and no questions are saved. This keeps the question bank clean and avoids half-imported files.

Expected question fields include:

- Question type
- Question content
- Options
- Correct option
- Difficulty
- Topic
- Sub-topics

## Adaptive Assignment Flow

The AI assignment flow works like this:

1. A student's weak topics are identified.
2. The AI backend matches those weak topics with related question bank topics.
3. The service chooses questions at the right difficulty level.
4. A PDF assignment is generated.
5. The PDF is returned for download.

Faculty can also override the suggested difficulty when needed.

## Local Setup

Start the databases:

```powershell
docker compose up -d
```

Install dependencies for each app:

```powershell
cd backend-core
npm install

cd ..\frontend-web
npm install

cd ..\desktop-client
npm install

cd ..\backend-ai
pip install -r requirements.txt
```

Common environment values used by the services:

```text
DATABASE_URL=postgresql://cira_user:cira_password@localhost:5432/cira_db
MONGO_URI=mongodb://localhost:27017/cira-exams
JWT_SECRET=your-secret-value
```

Run the web app:

```powershell
cd frontend-web
npm run dev
```

Run the desktop client:

```powershell
cd desktop-client
npm start
```

Run the AI backend:

```powershell
cd backend-ai
python -m uvicorn src.main:app --reload --port 8000
```

The core backend currently contains the Express app and server entry point, but its `package.json` does not yet define a ready-made start script. A script can be added to run `src/index.ts` during development.

## Default Seed Data

The backend seed file creates:

- A default admin account
- Default departments
- Default sections

The default admin credentials in the seed file are:

```text
Email: admin@amrita.edu
Password: cira_admin@amrita
```

Change these before using the system outside local development.

## Architecture Summary

CIRA follows a simple separation of responsibilities:

- The **web app** is what users see and use.
- The **desktop client** provides a secure exam environment.
- The **core backend** manages the institution, users, exams, permissions, and normal analytics.
- The **AI backend** handles readiness calculations and adaptive assignment generation.
- **PostgreSQL** stores structured academic records.
- **MongoDB** stores flexible question and assignment data.

This structure keeps the product easier to grow. New dashboard features can be added to the web app, new platform rules can be added to the core backend, and new AI features can be added to the AI backend without mixing everything into one place.
