# Localhost Development Setup Guide

This guide walks you through setting up the **JV Cricket Auction Platform** locally on Windows.

## 📋 Prerequisites

Ensure you have the following installed on your system:
- **Python 3.10+** (Ensure "Add Python to PATH" is checked during installation)
- **Node.js 18.0+**
- **Git** (optional, for version control)

---

## 🔧 Backend Setup (Flask Server)

1. Open PowerShell or Command Prompt.
2. Navigate to the `backend` directory:
   ```powershell
   cd backend
   ```
3. Create a Python Virtual Environment:
   ```powershell
   python -m venv venv
   ```
4. Activate the virtual environment:
   ```powershell
   venv\Scripts\activate
   ```
5. Install backend dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
6. Check or modify the `.env` configuration file. The default configuration uses an SQLite database (`sqlite:///auction.db`), which is perfect for local testing:
   ```env
   FLASK_ENV=development
   FLASK_DEBUG=1
   SECRET_KEY=dev-secret-key-change-me
   JWT_SECRET_KEY=dev-jwt-secret-key-change-me
   DATABASE_URL=sqlite:///auction.db
   UPLOAD_FOLDER=uploads
   MAX_CONTENT_LENGTH=16777216
   FRONTEND_URL=http://localhost:3000
   ```
7. Start the backend server:
   ```powershell
   python app.py
   ```
   *The Flask application will start on **http://localhost:5000**.*

---

## 🗄️ Database Seeding & Mock Data

When you launch the backend for the first time, a default manager account is automatically created:
- **Email:** `jagadishvarma99@gmail.com`
- **Password:** `Jagadish223@`

To seed the database with a full set of demo tournaments, teams, and players:
1. Ensure your backend virtual environment is active.
2. Run the demo seeder:
   ```powershell
   python seed_demo.py
   ```
This will insert:
- Tournament: **JV Premier League 2026**
- 5 Teams with ₹10,00,000 budget each
- 15 Cricket Players with various playing styles and village details
- 3 Sponsors and 1 Active Advertisement

---

## 🎨 Frontend Setup (Next.js Application)

1. Open a new terminal window.
2. Navigate to the `frontend` directory:
   ```powershell
   cd frontend
   ```
3. Install dependencies:
   ```powershell
   npm install
   ```
4. Check that the `.env.local` file is created with:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```
5. Run the development server:
   ```powershell
   npm run dev
   ```
   *The Next.js application will start on **http://localhost:3000**.*

---

## 🧪 Verifying the Setup

1. Open your browser and navigate to **http://localhost:3000**.
2. You should see the premium IPL-style landing page with the seeded tournament name and countdown timer.
3. Click **Login** and log in using:
   - **Email:** `jagadishvarma99@gmail.com`
   - **Password:** `Jagadish223@`
4. Go to **Dashboard → Auction** to manage the live bidding process.
5. In another tab, open **http://localhost:3000/live** to watch the real-time bid updates as you make changes in the Dashboard.
