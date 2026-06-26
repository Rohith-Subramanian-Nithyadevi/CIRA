# CIRA - Secure Desktop Examination Application

CIRA is a full-stack educational assessment platform with AI capabilities, web dashboards, and a secure desktop client.

## 🏗️ Project Architecture

The project is divided into four main components and a unified database layer:

### 1. Database Layer (`docker-compose.yml`)
The root directory holds the global container orchestration file that sets up the database layer:
* **PostgreSQL 15 (`cira_postgres`)**: The primary relational database used by `backend-core`.
* **MongoDB 6.0 Replica Set (`mongo1`, `mongo2`, `mongo3`)**: A NoSQL database setup, essential for features like change streams and transactions, utilized by the `backend-ai` services.

### 2. Core Backend (`backend-core/`)
The primary backend API server built with **Node.js, Express, TypeScript, and Prisma ORM**. It handles standard operations, business logic, and interacts with PostgreSQL.
* **Database Schema (`prisma/schema.prisma`)**: Defines models for Users (Students, Admins, Faculty), Academic Hierarchy (Departments, Sections), and Assessments (Quizzes, Assignments, Results).
* **Controllers & Routes (`src/`)**: 
  * `auth`: Handles user registration, login, and JWT token generation.
  * `admin` & `faculty`: Endpoints for administrators and teachers to manage users, departments, and exams.
  * `exam` & `student`: Handles student exam sessions and quiz attempts.
  * `analytics`: Fetches reporting metrics and assessment results.

### 3. AI Backend (`backend-ai/`)
A specialized microservice built with **Python, FastAPI, and Motor (Async MongoDB)**. It handles heavy computational tasks, AI processing, and analytics.
* **Services (`src/services/`)**:
  * `nlp_service.py`: Uses `sentence-transformers` for Natural Language Processing (e.g., auto-grading subjective answers, plagiarism detection).
  * `assignment_service.py`: Automates assignment evaluation and provides intelligent feedback on student submissions.
  * `analytics_service.py`: Uses `scikit-learn` to process student performance metrics and generate insights/predictive analytics.

### 4. Web Frontend (`frontend-web/`)
The user-facing web dashboard built using **React 19, TypeScript, Vite, and Tailwind CSS**.
* **Pages (`src/pages/`)**:
  * `AdminDashboard`: A comprehensive dashboard for administrators to oversee the platform.
  * `FacultyDashboard`: Interface for teachers to create exams, review assignments, and check class analytics.
  * `StudentDashboard`: Interface for students to view scheduled exams, assignments, and results.
  * `Login` & `LandingPage`: Authentication and entry points.

### 5. Desktop Client (`desktop-client/`)
A secure examination browser built using **Electron**.
* Functions as a lockdown browser for students taking exams, ensuring a secure and anti-cheat environment.
* Interacts directly with the Core Backend to start and manage secure exam sessions.

## 🔄 System Workflow

1. **Infrastructure setup**: The `docker-compose` spins up the Postgres and Mongo databases.
2. **Configuration**: Admins and Faculty use the **Web Frontend** to set up departments, quizzes, and assignments. Data is stored in Postgres via the **Core Backend**.
3. **Examination**: Students log into the **Desktop Client** (secure Electron app) to take their quizzes and assessments without the ability to cheat.
4. **AI Processing**: Once submitted, the Core Backend communicates with the **AI Backend** to perform NLP-based auto-grading or to generate machine-learning analytics on performance.
5. **Review**: Faculty and Students can view the AI-processed grades and visual analytics back on the Web Frontend dashboards.