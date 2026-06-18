# 🏏 JV Cricket Auction Platform

A production-ready Cricket Tournament Auction Platform for local cricket tournaments. Features live real-time player auctions, tournament management, team management, player management, analytics, reports, and public live viewing.

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Python 3.10+** with pip
- **Node.js 18+** with npm
- **Windows OS** (primary target)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
python app.py
```

The backend will start at **http://localhost:5000**

> The manager account is automatically seeded on first startup:
> - Email: `jagadishvarma99@gmail.com`
> - Password: `Jagadish223@`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend will start at **http://localhost:3000**

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4, ShadCN UI |
| Backend | Python Flask, Flask-SocketIO, SQLAlchemy |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Real-time | Socket.IO (WebSocket) |
| Auth | JWT (Flask-JWT-Extended) + Bcrypt |
| Charts | Recharts |
| State | Zustand + React Query |
| Deploy | AWS (Terraform) |

## 📁 Project Structure

```
Auction/
├── backend/
│   ├── app.py              # Flask entry point
│   ├── config.py           # Environment config
│   ├── seed.py             # Manager account seeder
│   ├── models/             # SQLAlchemy models
│   ├── routes/             # REST API blueprints
│   ├── sockets/            # Socket.IO auction engine
│   ├── middleware/          # Auth & RBAC
│   ├── utils/              # Helpers
│   └── uploads/            # File storage (dev)
├── frontend/
│   ├── src/app/            # Next.js pages
│   ├── src/components/     # UI components
│   ├── src/lib/            # API client, socket, store
│   └── src/types/          # TypeScript interfaces
├── terraform/              # AWS infrastructure
└── docs/                   # Documentation
```

## 👤 User Roles

| Role | Access |
|------|--------|
| **Manager** | Full access - manage tournaments, teams, players, auction controls, users |
| **Admin** | Player management, view auction & analytics |

## 🎯 Features

- ✅ Live real-time auction with Socket.IO
- ✅ IPL-style dark navy + gold premium UI
- ✅ Tournament management (CRUD)
- ✅ Team management with budget tracking
- ✅ Player management with bulk import (CSV/Excel)
- ✅ Real-time bidding with validation
- ✅ Public live viewer (no login needed)
- ✅ Analytics dashboard with charts
- ✅ Reports export (CSV, Excel, PDF)
- ✅ JWT authentication with RBAC
- ✅ Mobile-responsive design
- ✅ Manager/Admin role separation

## 🌐 Domain

**Production:** jagadishvarma.xyz

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | JWT Login |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/tournaments` | Tournament CRUD |
| GET/POST | `/api/tournaments/:id/teams` | Team CRUD |
| GET/POST | `/api/tournaments/:id/players` | Player CRUD |
| POST | `/api/tournaments/:id/players/bulk-import` | Bulk import |
| GET | `/api/analytics/dashboard/:id` | Dashboard stats |
| GET | `/api/reports/players/:id` | Export reports |
| GET | `/api/public/tournament` | Public tournament info |
| GET | `/api/public/live/:id` | Live auction state |

## ⚡ Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `auction:start` | Client → Server | Start auction |
| `auction:place_bid` | Client → Server | Place bid |
| `auction:sell` | Client → Server | Confirm sale |
| `auction:state` | Server → Client | Full state update |
| `auction:bid_update` | Server → Client | New bid notification |
| `auction:player_sold` | Server → Client | Player sold notification |

## 📄 License

Private — JV Cricket © 2024
