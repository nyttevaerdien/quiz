# Quiz Bot & Real-Time Web App (v3.2.0)

A multi-platform quiz system supporting both Telegram bot players and a mobile-optimized Web App (iOS & Android) with real-time Socket.IO synchronization, automated answer checking with fuzzy matching, and an administrative control center.

## Architecture

- **Telegram Bot**: Python-based bot for Telegram player participation (`bot.py`)
- **Backend**: NestJS (TypeScript) with Socket.IO and REST API on port `5000`
- **Frontend**: React + Vite + Tailwind CSS responsive web app on port `3000`
- **RabbitMQ**: Message queue bridging events between Telegram bot and web backend
- **SQLite Database**: Shared database (`db/quiz.db`) for players, answers, game state, and answer keys

## Services

- `backend`: NestJS REST & WebSocket API (`nyttevaerdien/quiz-backend:3.2.0`)
- `frontend`: React SPA served via Nginx (`nyttevaerdien/quiz-frontend:3.2.0`)
- `bot`: Python Telegram bot (`Dockerfile.bot`)
- `rabbitmq`: RabbitMQ message broker (`rabbitmq:3-management-alpine`)

## Features

### Host & Admin Control Center (Web)
- **🎮 Game Flow**: Start/end games, advance questions (`Q1, Q2...`), enter grading phase.
- **🔑 Answer Keys**: Predefine correct answers before/during game; in-line key editing; instant automatic evaluation for incoming & existing submissions using `fast-fuzzy`.
- **📊 Answers Matrix**: Grid of participants and questions, displaying real-time answers, manual override checkboxes, and a dedicated **Answer Keys bottom row** for quick verification.
- **🏆 Live Standings**: Real-time scores and ranking with celebratory visuals.
- **👥 User Management**: View active participants vs registered users, with one-click player removal.

### Player Experience (Mobile Web & Telegram)
- **Mobile First**: Clean UI with responsive touch controls and auto dark mode (`prefers-color-scheme`).
- **Real-Time Sync**: Instant socket updates when questions advance or game state changes.
- **Telegram Bot**: Full `/register`, `/join_game`, and question answering support via Telegram.

## Quick Start

1. **Clone repository**:
   ```bash
   git clone https://github.com/nyttevaerdien/quiz.git
   cd quiz
   ```

2. **Set your environment variables**:
   Create a `.env` file or export:
   ```bash
   BOT_TOKEN=your_telegram_bot_token_here
   ```

3. **Start all services with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

4. **Access the applications**:
   - Web App (Players & Admin): `http://localhost:3000`
   - Backend API & WebSockets: `http://localhost:5000`
   - Admin default password: `admin`
   - RabbitMQ Management: `http://localhost:15672` (admin / admin123)

## Docker Hub Images

- **Backend**: `nyttevaerdien/quiz-backend:3.2.0` (also tagged `latest`)
- **Frontend**: `nyttevaerdien/quiz-frontend:3.2.0` (also tagged `latest`)
