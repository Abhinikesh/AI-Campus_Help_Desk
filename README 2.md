# 🎓 CampusSphere AI

> Role-based AI-powered smart campus helpdesk integrating
> multi-agent intelligence, virtual navigation, and centralized
> student services into one digital platform.

## Tech Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: MongoDB
- AI: Google Gemini 1.5 Flash
- Auth: JWT + httpOnly cookies

## Quick Start

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Gemini API key

### Install & Run
```bash
npm run install-all
# Add GEMINI_API_KEY to server/.env
npm run seed
npm run dev
```

### Demo Credentials
| Role    | Login                          | Password    |
|---------|-------------------------------|-------------|
| Student | Roll: 20240001                | student123  |
| Faculty | faculty@campus.edu            | faculty123  |
| Admin   | admin@campus.edu              | admin1234   |
| Parent  | parent@campus.edu             | parent123   |
| Visitor | Name + Purpose (no password)  | -           |

### Features
- 🤖 Multi-agent AI (Academic/Admin/Navigation/Complaint)
- 🗺 360° Virtual Campus Tour
- 📊 Real-time Attendance Tracking
- 📝 Smart Complaint System
- 📁 Academic Drive
- 🔐 Role-based Access Control
- 📱 Fully Responsive Design


1. Ensure Dependencies are Installed

cd ~/AI-Enabled_Campus_Help_Desk/campussphere-ai/
npm run install-all

2. Seed the MongoDB Database

# Still in campussphere-ai/
npm run seed

3. Run the Full Stack

# Still in campussphere-ai/
npm run dev

4. ensure to check the folder name sphere-ai at laste
cd ~/AI-Enabled_Campus_Help_Desk/campussphere-ai && npm run dev


5. if error kill node 

killall node

6. final run

npm run dev
