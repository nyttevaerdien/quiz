# Quiz Bot & Web Application

A full-featured Quiz platform combining a Telegram Bot, a mobile-optimized React Web App for players, and a unified Admin Dashboard, powered by a single NestJS backend (Node.js/TypeScript), SQLite, and RabbitMQ.

## Architecture

- **Web Application (React + TypeScript + Tailwind CSS)**:
  - **Mobile-first Player UI**: Register nickname, join active games, view live questions, submit/edit answers with real-time feedback, and view the live leaderboard.
  - **Host / Admin Dashboard**: Start games (with automatic backups), advance questions, manage grading matrix with one-click toggles, manage users, and observe the live leaderboard.
- **Backend (NestJS + TypeScript)**:
  - Unified REST API & Socket.IO WebSocket Gateway for instant real-time synchronization across web clients.
  - SQLite database access (`better-sqlite3` with WAL mode).
  - RabbitMQ Producer for message broadcasting to Telegram players.
- **Telegram Bot (Python)**:
  - Interacts with players via Telegram commands (`/register`, `/join_game`, `/status`, answers).
  - Consumes RabbitMQ broadcasts to notify Telegram players of game events in real-time.
- **RabbitMQ**: Message queue bridging the NestJS backend and the Telegram bot.
- **SQLite Database**: Single source of truth (`db/quiz.db`) shared seamlessly by the NestJS backend and Telegram bot.

## Services

- `webapp`: NestJS backend + built React frontend (Port 5000)
- `bot`: Python Telegram bot service
- `rabbitmq`: RabbitMQ message broker (Port 5672, Management UI 15672)

## Features

### Unified Admin Dashboard
- **🎮 Game Management**: Start/end games, control game flow
- **📝 Answers Tab**: Real-time answers viewing with auto-refresh every 3 seconds
- **🏆 Leaderboard Tab**: Live leaderboard with auto-refresh every 3 seconds
- **👥 Users Tab**: User management with auto-refresh every 3 seconds
- **Real-time Updates**: All tabs refresh automatically when active

### Bot Features
- User registration with nicknames
- Game participation management
- Answer collection and validation
- Automatic backups before game starts

## Quick Start

1. **Clone and setup**:
   ```bash
   git clone https://github.com/nyttevaerdien/quiz-game.git
   cd quiz-game
   ```

2. **Set your bot token**:
   ```bash
   export BOT_TOKEN=your_telegram_bot_token_here
   ```

3. **Start all services**:
   ```bash
   docker-compose up -d
   ```

4. **Access services**:
   - Web Admin Dashboard: http://localhost:5000
   - Bot: Available via Telegram

## Configuration

### Environment Variables

- `BOT_TOKEN`: Your Telegram bot token from @BotFather
- `RABBITMQ_URL`: RabbitMQ connection URL
- `DATABASE_PATH`: Path to SQLite database file

### Default Credentials

- Admin Panel Password: `admin`

## Usage

### For Players

1. Start a conversation with your bot on Telegram
2. Use `/register` to register with a nickname
3. Use `/join_game` to join active games
4. Answer questions when prompted
5. View your progress in real-time

### For Admins

1. Access the unified dashboard at http://localhost:5000
2. Login with password `admin`
3. Use the tabbed interface to:
   - **Game Tab**: Start/end games, control game flow
   - **Answers Tab**: View and grade player answers (auto-refreshes)
   - **Leaderboard Tab**: Monitor player rankings (auto-refreshes)
   - **Users Tab**: Manage registered users (auto-refreshes)

## Development

### Building Images

```bash
# Build bot service
docker build -f Dockerfile.bot -t quiz-bot .

# Build webapp service
docker build -f Dockerfile.webapp -t quiz-webapp .
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f bot
docker-compose logs -f webapp
docker-compose logs -f rabbitmq
```

### Stopping Services

```bash
docker-compose down
```

### Data Persistence

- Database files are stored in `./db/` directory
- RabbitMQ data is persisted in Docker volumes
- Backups are created automatically in `./db/backups/`

## API Endpoints

- `GET /api/refresh`: Get fresh data for all tabs
- `POST /api/toggle_correct`: Toggle answer correctness
- `GET /api/health`: Health check endpoint

## Troubleshooting

### Common Issues

1. **Bot not responding**: Check BOT_TOKEN environment variable
2. **RabbitMQ connection errors**: Ensure RabbitMQ is healthy before starting bot/webapp
3. **Database errors**: Check file permissions on ./db directory
4. **Auto-refresh not working**: Check browser console for JavaScript errors

### Health Checks

- Webapp: http://localhost:5000/api/health

### Logs

```bash
# Check service status
docker-compose ps

# View detailed logs
docker-compose logs --tail=100 bot
docker-compose logs --tail=100 webapp
```

## Project Structure

```
quiz-game/
├── bot.py                 # Telegram bot
├── webapp.py             # Flask web application
├── database.py           # Database operations
├── rabbitmq_producer.py  # RabbitMQ message producer
├── rabbitmq_consumer.py  # RabbitMQ message consumer
├── templates/
│   ├── admin_dashboard.html  # Unified admin interface
│   └── admin_login.html      # Admin authentication
├── db/                   # Database files
├── docker-compose.yml    # Docker services configuration
├── Dockerfile.bot        # Bot service container
├── Dockerfile.webapp     # Webapp service container
└── requirements.txt      # Python dependencies
```

## Recent Updates

- ✅ Unified admin dashboard with tabbed interface
- ✅ Real-time auto-refresh for Answers, Leaderboard, and Users tabs
- ✅ Removed redundant template files
- ✅ Switched from Kafka to RabbitMQ
- ✅ Improved user experience with immediate data refresh
- ✅ Clean, maintainable codebase structure
