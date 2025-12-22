import json
import os
import logging
import threading
import time
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from dotenv import load_dotenv
from database import db
from rabbitmq_consumer import rabbitmq_consumer

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Bot token from environment variable
BOT_TOKEN = os.getenv('BOT_TOKEN', 'YOUR_BOT_TOKEN')

# Global variables
user_states = {}  # Store user states for registration process

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the /start command"""
    game_state = db.get_game_state()
    game_status = "🟢 ACTIVE" if game_state['is_active'] else "🔴 INACTIVE"
    welcome_message = f"""
Welcome to Quiz Bot! 🎯

👤 PLAYER COMMANDS:
/register - Register with a nickname
/join_game - Join the current game
/status - Check game status
/help - Show this help message

Current game status: {game_status}

Use /register to get started, then /join_game to participate!
    """
    await update.message.reply_text(welcome_message)

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the /help command"""
    game_state = db.get_game_state()
    game_status = "🟢 ACTIVE" if game_state['is_active'] else "🔴 INACTIVE"
    help_message = f"""
Quiz Bot Commands:

👤 PLAYER COMMANDS:
/register - Register with a nickname
/join_game - Join the current game
/status - Check game status
/help - Show this help message

Current game status: {game_status}

After registration, the bot will greet you with your nickname!
    """
    await update.message.reply_text(help_message)

async def register_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the /register command"""
    user_id = update.effective_user.id
    
    # Check if user is already registered
    existing_user = db.get_user(str(user_id))
    if existing_user:
        await update.message.reply_text(f"You are already registered as: {existing_user['nickname']}")
        return
    
    # Set user state to waiting for nickname
    user_states[user_id] = 'waiting_for_nickname'
    
    await update.message.reply_text('Please enter your nickname:')

async def join_game_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the /join_game command"""
    user_id = update.effective_user.id
    
    # Check if user is registered
    existing_user = db.get_user(str(user_id))
    if not existing_user:
        await update.message.reply_text('❌ You need to register first! Use /register to get started.')
        return
    
    # Check if there's an active game
    game_state = db.get_game_state()
    if not game_state['is_active']:
        await update.message.reply_text('❌ No active game found. Wait for a game to be started!')
        return
    
    # Check if user is already a participant
    if db.is_game_participant(str(user_id)):
        await update.message.reply_text('✅ You are already participating in this game!')
        return
    
    # Add user to game participants
    success = db.add_game_participant(str(user_id), existing_user['nickname'])
    if success:
        participants = db.get_game_participants()
        participant_count = len(participants)
        
        # Send confirmation to the joining user
        await update.message.reply_text(f'🎮 Successfully joined the game! You are participant #{participant_count}.\n\n⏳ Wait for the next question...')
        
        # Notify other participants about the new player (exclude the person who just joined)
        if participant_count > 1:  # Only notify if there are other participants
            from rabbitmq_producer import rabbitmq_producer
            notification_message = f"👋 {existing_user['nickname']} joined the game! ({participant_count} players total)"
            # Send message with exclude parameter
            rabbitmq_producer.send_message(notification_message, 'broadcast', str(user_id))
        else:
            # First player joined - notify them they're the first
            await update.message.reply_text("🎯 You're the first player! Waiting for more players to join...")
        
        # If there's an active question, notify the new participant about it
        game_state = db.get_game_state()
        if game_state.get('collecting_answers', False) and game_state.get('current_question', 0) > 0:
            current_q = game_state['current_question']
            await update.message.reply_text(f"📝 Current question is Question {current_q}. You can answer now!")
    else:
        await update.message.reply_text('❌ Failed to join the game. Please try again.')

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the /status command"""
    user_id = update.effective_user.id
    
    # Check if user is registered
    existing_user = db.get_user(str(user_id))
    if not existing_user:
        await update.message.reply_text('❌ You need to register first! Use /register to get started.')
        return
    
    # Show current game status
    game_state = db.get_game_state()
    if game_state['is_active']:
        status_message = f"""
🎮 GAME STATUS

🟢 GAME ACTIVE
• Started: {game_state.get('start_time', 'Unknown')}
• Started by: Game Host

📋 PLAYER COMMANDS:
/join_game - Join the current game
/status - Check game status
/help - Show all commands

⏳ Please wait for the next question...
        """
    else:
        status_message = """
🎮 GAME STATUS

🔴 NO ACTIVE GAME
• Wait for a game to be started

📋 AVAILABLE COMMANDS:
/register - Register with a nickname
/help - Show all commands
        """
    
    await update.message.reply_text(status_message)

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text messages"""
    user_id = update.effective_user.id
    text = update.message.text
    
    # Skip if it's a command
    if text and text.startswith('/'):
        return
    
    # Handle nickname registration
    if user_id in user_states and user_states[user_id] == 'waiting_for_nickname':
        if text and text.strip():
            nickname = text.strip()
            
            # Store the nickname in database
            if db.add_user(str(user_id), nickname):
                # Clear user state
                del user_states[user_id]
                
                # Send welcome message
                await update.message.reply_text(f"Hello {nickname}! 👋\n\nYou have been successfully registered!")
            else:
                await update.message.reply_text('❌ Error registering. Please try again.')
        else:
            await update.message.reply_text('Please enter a valid nickname (non-empty text):')
        return
    
    # Handle answer collection during active game
    game_state = db.get_game_state()
    if game_state['is_active'] and game_state.get('collecting_answers', False):
        # Check if user is registered
        existing_user = db.get_user(str(user_id))
        if not existing_user:
            await update.message.reply_text('❌ You need to register first! Use /register to get started.')
            return
        
        # Store the answer
        current_question = game_state.get('current_question', 1)
        logger.info(f"Processing answer for question {current_question}, game_state: {game_state}")
        
        if db.save_answer(str(user_id), current_question, text.strip()):
            await update.message.reply_text(f'✅ Answer recorded for Question {current_question}!\n\nAnswer: {text.strip()}')
        else:
            await update.message.reply_text('❌ Error saving answer. Please try again.')

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle errors"""
    logger.error(f"Update {update} caused error {context.error}")

def main():
    """Start the bot"""
    # Support custom Telegram API base URL (for mock/testing)
    telegram_api_base_url = os.getenv('TELEGRAM_API_BASE_URL')
    
    # Debug: Log environment variable
    logger.info(f"TELEGRAM_API_BASE_URL from env: {telegram_api_base_url}")
    logger.info(f"BOT_TOKEN from env: {BOT_TOKEN[:10] if BOT_TOKEN else 'None'}...")
    
    # Create application builder
    builder = Application.builder().token(BOT_TOKEN)
    
    # Set custom base URL if provided (for performance testing with mock)
    if telegram_api_base_url:
        # Remove trailing slash if present
        base_url = telegram_api_base_url.rstrip('/')
        logger.info(f"Setting custom Telegram API base URL: {base_url}")
        builder = builder.base_url(base_url)
        logger.info(f"✅ Custom Telegram API base URL configured: {base_url}")
    else:
        logger.info("⚠️ No TELEGRAM_API_BASE_URL set, using default Telegram API")
    
    # Build application
    application = builder.build()
    
    # Add command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("register", register_command))
    application.add_handler(CommandHandler("join_game", join_game_command))
    application.add_handler(CommandHandler("status", status_command))
    
    # Add message handler
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    # Add error handler
    application.add_error_handler(error_handler)
    
    # Start the bot
    print("Bot is running...")
    print("Make sure to set your BOT_TOKEN environment variable or replace YOUR_BOT_TOKEN in the code")
    
    # Start RabbitMQ consumer
    rabbitmq_consumer.start(application)
    
    # Initialize RabbitMQ producer
    from rabbitmq_producer import rabbitmq_producer
    rabbitmq_producer._connect()
    print("RabbitMQ producer initialized")
    
    # Run the bot until the user presses Ctrl-C
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
