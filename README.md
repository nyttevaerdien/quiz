# Spooky Quiz — Real-Time Web App (v3.4.0)

A mobile-optimized real-time Web App quiz (iOS & Android) with Socket.IO synchronization, automated answer checking with fuzzy matching, and an administrative control center.

## Architecture

- **Backend**: NestJS (TypeScript) with Socket.IO and REST API on port `5000`
- **Frontend**: React + Vite + Tailwind CSS responsive web app on port `3000`
- **SQLite Database**: Shared database (`db/quiz.db`) for players, answers, game state, and answer keys

## Services

- `backend`: NestJS REST & WebSocket API (`nyttevaerdien/quiz-backend:3.4.0`)
- `frontend`: React SPA served via Nginx (`nyttevaerdien/quiz-frontend:3.4.0`)

## Features

### Host & Admin Control Center (Web)
- **🎮 Game Flow**: Start/end games, advance questions (`Q1, Q2...`), enter grading phase.
- **🔑 Answer Keys**: Predefine correct answers before/during game; in-line key editing; instant automatic evaluation for incoming & existing submissions using `fast-fuzzy`.
- **📊 Answers Matrix**: Grid of participants and questions, displaying real-time answers, manual override checkboxes, and a dedicated **Answer Keys bottom row** for quick verification.
- **🏆 Live Standings**: Real-time scores and ranking with celebratory visuals.
- **👥 User Management**: View active participants vs registered users, with one-click player removal.

### Player Experience (Mobile Web)
- **Mobile First**: Clean UI with responsive touch controls and auto dark mode (`prefers-color-scheme`).
- **Real-Time Sync**: Instant socket updates when questions advance or game state changes.

## Quick Start

1. **Clone repository**:
   ```bash
   git clone https://github.com/nyttevaerdien/quiz.git
   cd quiz
   ```

2. **Set your environment variables**:
   Create a `.env` file next to `docker-compose.yml` (picked up by Docker Compose automatically). For running the backend locally without Docker, also create `backend/.env` (see `backend/.env.example`):
   ```bash
   ADMIN_PASSWORD=generate_a_long_random_secret   # e.g. openssl rand -hex 24
   ```
   The admin panel password is read **only** from the `ADMIN_PASSWORD` env variable — the backend refuses to start without it (min 8 chars). Never commit real secrets: `.env` is git-ignored.

3. **Start all services with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

4. **Access the applications**:
   - Web App (Players & Admin): `http://localhost:3000`
   - Backend API & WebSockets: `http://localhost:5000`
   - Admin password: the value of `ADMIN_PASSWORD` from your `.env` file

## Docker Hub Images

- **Backend**: `nyttevaerdien/quiz-backend:3.4.0` (also tagged `latest`)
- **Frontend**: `nyttevaerdien/quiz-frontend:3.4.0` (also tagged `latest`)
