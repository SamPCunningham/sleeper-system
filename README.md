# Sleeper System

A web application for managing tabletop RPG sessions with real-time dice rolling and shared game state.

## Tech Stack

- **Backend**: Go + PostgreSQL
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Real-time**: WebSockets

## Getting Started

### Prerequisites
- Go 1.21+
- Node.js 18+
- Docker & Docker Compose

### Setup

1. Start the database:
```bash
docker-compose up -d
```

2. Run the backend:
```bash
cd backend
go run cmd/server/main.go
```

3. Run the frontend:
```bash
cd frontend
npm install
npm run dev
```

### Development

- Backend runs on: http://localhost:8090
- Frontend runs on: http://localhost:5173
- Database runs on: localhost:5432

### Health Check
```bash
curl http://localhost:8090/health
```
