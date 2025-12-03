# TalentLens — AI-Powered Resume Screening & Job Matching Platform

TalentLens is an enterprise-grade recruitment platform designed to automate resume screening and semantic job matching. It leverages Large Language Models (LLM) and Vector Search to match candidates to job descriptions based on skills and context, featuring dedicated dashboards for Recruiters and Hiring Managers.

---

## 📌 Overview

-   **AI-Driven Parsing:** Automated extraction of skills, experience, and metadata from resumes using Llama 3.
-   **Semantic Matching:** Vector-based search (Qdrant) to rank candidates against Job Descriptions (JDs) accurately.
-   **Role-Based Workflows:** Distinct interfaces for Recruiters (upload/search) and Hiring Managers (review/approve).
-   **Global Hiring Pipeline:** Persistent tracking of candidate status (Applied → Interview → Offer) across all user sessions using PostgreSQL.
-   **Analytics Dashboard:** Visual insights into candidate pools, skill gaps, and hiring pipeline stages.

---

## 🚀 Key Features

### 🔍 Smart Matching & Parsing
-   **Bulk Resume Upload:** Process PDFs/DOCX with auto-deduplication (Hash-based) and text extraction.
-   **Contextual Analysis:** AI extracts hard technical skills while filtering out generic terms and soft skills.
-   **Precision Scoring:** Candidates are scored based on semantic similarity + keyword overlap with the JD.

### 📊 Hiring Management
-   **Global Stage Tracking:** A unified dropdown to track candidates through 6+ stages (Screening, Interview L1-L5, Accepted, Rejected).
-   **Persistent State:** Hiring decisions are stored in PostgreSQL, ensuring all managers see the same real-time status.
-   **Interactive Analytics:** Filter candidates by CPD level, experience years, and specific technical skills.

### 📄 Document Handling
-   **In-App Viewer:** Securely view Resumes and JDs via AWS S3 without downloading files locally.
-   **Smart JD Creation:** Create and edit Job Descriptions with auto-generated PDF formatting.

---

## 🛠 Tech Stack

| Layer | Technology | Usage |
| :--- | :--- | :--- |
| **Frontend** | React.js + Tailwind CSS | Responsive UI & Dashboards |
| **Backend** | Django + REST Framework | API Logic & Orchestration |
| **Vector DB** | Qdrant | Semantic Search & Resume Matching |
| **Relational DB** | PostgreSQL | User Data, Hiring Stages & Decisions |
| **Storage** | AWS S3 | Secure Document Storage (PDFs) |
| **AI / ML** | Llama 3 + HuggingFace | Resume Parsing & Embedding Generation |

---

## 📂 Folder Structure
### Backend
```
Backend/
├── mysite/
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── resume/
│   ├── migrations/
│   ├── services/
│   │   ├── embedding_service.py
│   │   ├── extract_data.py
│   │   ├── jd_keyword_service.py
│   │   ├── pdf_parser.py
│   │   ├── qdrant_service.py
│   │   └── s3_service.py
│   ├── models.py
│   ├── views.py
│   ├── job_views.py
│   ├── urls.py
│   ├── apps.py
│   └── __init__.py
├── .env
├── .gitignore
├── db.sqlite3
├── manage.py
└── requirements.txt
```

### Frontend
```
Frontend/
├── public/
├── src/
│   ├── api/
│   ├── assets/
│   ├── components/
│   │   └── sidebar/
│   │       ├── HiringManagerSidebar.jsx
│   │       └── RecruiterSidebar.jsx
│   ├── pages/
│   │   ├── AnalyticsDetails.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Description.jsx
│   │   ├── Drafts.jsx
│   │   ├── JobDescriptionMatch.jsx
│   │   ├── Login.jsx
│   │   ├── ManagerDashboard.jsx
│   │   ├── Managerpage.jsx
│   │   ├── MatchedResume.jsx
│   │   ├── Preview.jsx
│   │   ├── PublishedJDs.jsx
│   │   ├── RecruiterDashboard.jsx
│   │   ├── RecruiterHome.jsx
│   │   ├── Register.jsx
│   │   ├── Retrieve.jsx
│   │   ├── Upload.jsx
│   │   ├── ViewJD.jsx
│   │   └── ViewResume.jsx
│   ├── App.jsx
│   ├── config.js
│   ├── index.css
│   └── main.jsx
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── vite.config.js
└── README.md
```
---

## ⚙️ Setup Instructions

### 1. Backend Setup
```bash
# Navigate to backend
cd skill-analytics/Backend

# Install dependencies
pip install -r requirements.txt

# Database Migration (Crucial for Hiring Stage feature)
python manage.py makemigrations
python manage.py migrate

# Start Server
python manage.py runserver
```

### 2. Frontend Setup
```bash
# Navigate to frontend
cd skill-analytics/Frontend

# Install dependencies
npm install

# Start Client
npm run dev
```
