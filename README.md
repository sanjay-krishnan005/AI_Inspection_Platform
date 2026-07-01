# 🏗️ AIInspect Pro - AI Construction & Workforce Management

<div align="center">
  <p><em>An AI-powered, mobile-first Progressive Web App (PWA) for real-time construction inspection, defect mapping, and contractor workforce dispatching.</em></p>
</div>

---

## 🚧 The Problem Statement
Construction site inspections and defect management are notoriously fragmented. Currently, site inspectors manually log defects on clipboards or disconnected apps, take photos, and manually relay these to project managers. Managers then manually dispatch work orders to contractors, leading to:
- **Communication Delays & Schedule Slips:** Hours or days lost in the chain of reporting.
- **Lost Accountability:** Contractors struggle to map written defect reports to physical on-site locations.
- **Lack of Visibility:** Project managers have no real-time pulse on site health or contractor rework rates.

## 💡 The Solution
**AIInspect Pro** centralizes the entire defect lifecycle into a unified, AI-assisted platform. 
By providing dedicated workflows for **Inspectors**, **Managers**, and **Contractors** within a single Mobile-First ecosystem, the platform ensures that the moment a defect is logged on-site, it is instantly analyzed, visualized on a heat map, and dispatched to the right contractor team for resolution.

### 🌟 Key Features
- **📱 Progressive Web App (PWA):** Installs natively on iOS and Android straight from the browser. Full-screen, mobile-optimized CRM interface.
- **👥 Role-Based Workflows:**
  - **Inspectors:** Streamlined "Field Capture" interface to instantly snap photos and log defects.
  - **Project Managers:** "Workflow Queue" and "Analytics" dashboard to review, dispatch, and monitor schedule impacts via live site heatmaps.
  - **Contractors:** Simplified "My Tasks" view to see assigned work, update progress, and submit proof of repairs.
- **🧠 AI-Assisted Workflows:** Intelligent categorization of defects, severity prediction, and automated schedule-slip detection.
- **📍 Live Site Heatmap:** Instantly visualize where the highest concentration of active risks are located across different construction zones.

---

## 🛠️ Tech Stack

**Frontend Architecture:**
- **Framework:** Next.js 14 (App Router, Turbopack)
- **UI Library:** React 19
- **Styling:** Tailwind CSS + Vanilla CSS Modules (Glassmorphism & Mobile-first design)
- **PWA Configuration:** `@ducanh2912/next-pwa`
- **Charts/Visuals:** Chart.js, Lucide React

**Backend Architecture:**
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL (with SQLAlchemy ORM)
- **Authentication:** JWT Bearer tokens
- **AI Integration:** LLM-powered context and chat analysis

---

## 🚀 Getting Started

Follow these steps to run the platform locally on your machine.

### 1. Backend Setup (FastAPI)
Navigate to the `backend` directory and set up your Python environment:
```bash
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Start the development server
python -m uvicorn app.main:app --port 8000 --reload
```
*The backend will be running at `http://localhost:8000`*

### 2. Frontend Setup (Next.js)
Navigate to the `frontend` directory:
```bash
cd frontend

# Install Node dependencies
npm install

# Start the Next.js development server
npm run dev
```
*The frontend will be running at `http://localhost:3000`*

---

## 📱 Installing the Mobile PWA
Because AIInspect Pro is a Progressive Web App, you can install it on your mobile device for a native experience:
1. Ensure the app is deployed (e.g., to Vercel/Render).
2. Open the URL in Safari (iOS) or Chrome (Android).
3. Tap **Share** -> **"Add to Home Screen"** (iOS) or select the **"Install App"** prompt (Android).
4. The app will install with a native icon and launch in full-screen standalone mode!

---

## 🏗️ Project Architecture & Design Philosophy
This project was designed with a strict **Mobile-First** methodology. Because the primary users (Inspectors and Contractors) are physically on a construction site, the UI utilizes large tap targets, intuitive swipe-friendly cards, and a dynamic bottom navigation bar that adapts to the currently logged-in role. The platform strictly separates concerns so that no user is ever overwhelmed by data that doesn't pertain to their immediate workflow.

## 🤝 License
This project is licensed under the MIT License.
