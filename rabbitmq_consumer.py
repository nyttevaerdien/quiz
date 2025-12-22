import os
import json
import logging
import threading
import time
import asyncio
import pika
import pika.exceptions
from typing import Optional
from database import db

logger = logging.getLogger(__name__)

class RabbitMQMessageConsumer:
    """RabbitMQ message consumer for the bot"""
    
    def __init__(self, url: str = None, queue: str = None):
        self.url = url or os.getenv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672/')
        self.queue = queue or os.getenv('RABBITMQ_QUEUE', 'quiz-messages')
        self.connection = None
        self.channel = None
        self.running = False
        self.bot_application = None
        self.thread = None
    
    def _connect(self):
        """Connect to RabbitMQ with better connection handling"""
        try:
            # Add connection parameters for better stability
            connection_params = pika.ConnectionParameters(
                host='rabbitmq',
                port=5672,
                virtual_host='/',
                credentials=pika.PlainCredentials('admin', 'admin123'),
                heartbeat=30,  # Send heartbeat every 30 seconds
                blocked_connection_timeout=300,  # 5 minutes timeout
                connection_attempts=3,
                retry_delay=2
            )
            
            self.connection = pika.BlockingConnection(connection_params)
            self.channel = self.connection.channel()
            self.channel.queue_declare(queue=self.queue, durable=True)
            logger.info(f"Connected to RabbitMQ consumer at {self.url}")
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ consumer: {e}")
            self.connection = None
            self.channel = None
    
    def start(self, bot_application):
        """Start consuming messages"""
        if self.running:
            logger.warning("Consumer is already running")
            return True
        
        self.running = True
        self.bot_application = bot_application
        self.main_loop = None  # Will be set when we first need it
        
        self.thread = threading.Thread(target=self._consume_messages, daemon=True)
        self.thread.start()
        logger.info("RabbitMQ consumer started")
        return True
    
    def stop(self):
        """Stop consuming messages"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        if self.connection and not self.connection.is_closed:
            self.connection.close()
        logger.info("RabbitMQ consumer stopped")
    
    def _consume_messages(self):
        """Consume messages from RabbitMQ with automatic reconnection"""
        reconnect_delay = 1
        max_reconnect_delay = 60
        
        while self.running:
            try:
                # Connect to RabbitMQ
                self._connect()
                
                if not self.channel:
                    logger.error("Failed to connect to RabbitMQ, will retry...")
                    time.sleep(reconnect_delay)
                    reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)  # Exponential backoff
                    continue
                
                # Reset reconnect delay on successful connection
                reconnect_delay = 1
                
                # Set up consumer
                self.channel.basic_qos(prefetch_count=1)
                self.channel.basic_consume(
                    queue=self.queue,
                    on_message_callback=self._handle_message
                )
                
                logger.info(f"Waiting for messages from queue {self.queue}")
                
                # Start consuming
                while self.running:
                    try:
                        self.connection.process_data_events(time_limit=1)
                    except (pika.exceptions.ConnectionClosed, pika.exceptions.ChannelClosed) as e:
                        logger.warning(f"RabbitMQ connection lost during consumption: {e}")
                        break  # Break inner loop to reconnect
                    except Exception as e:
                        if self.running:
                            logger.error(f"Error consuming messages: {e}")
                            time.sleep(1)  # Wait before retrying
                        else:
                            break
                        
            except Exception as e:
                if self.running:
                    logger.error(f"Error in consumer loop: {e}, will retry...")
                    time.sleep(reconnect_delay)
                    reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)  # Exponential backoff
                else:
                    break
        
        logger.info("RabbitMQ consumer stopped")
    
    def _handle_message(self, channel, method, properties, body):
        """Handle incoming message"""
        try:
            message_data = json.loads(body.decode('utf-8'))
            message_type = message_data.get('type', 'broadcast')
            content = message_data.get('content', '')
            
            if message_type == 'broadcast' and content:
                # Broadcast message to all game participants
                exclude_user_id = message_data.get('exclude_user_id')
                self._broadcast_to_players(content, exclude_user_id)
            elif message_type == 'broadcast_all_users' and content:
                # Broadcast message to all registered users
                self._broadcast_to_all_users(content)
            
            # Acknowledge the message
            channel.basic_ack(delivery_tag=method.delivery_tag)
            
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            # Reject the message
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    
    def _broadcast_to_players(self, message: str, exclude_user_id: str = None):
        """Broadcast message to all game participants"""
        try:
            loop = self._get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    self._send_to_all_players(message, exclude_user_id),
                    loop
                )
            else:
                loop.run_until_complete(self._send_to_all_players(message, exclude_user_id))
            logger.info(f"Broadcast sent: {message}")

        except Exception as e:
            logger.error(f"Error broadcasting message: {e}")

    async def _send_to_all_players(self, message: str, exclude_user_id: str = None):
        """Send message to all game participants"""
        try:
            participants = db.get_game_participants()
            logger.info(f"📢 Broadcasting to {len(participants)} game participants: {list(participants.keys())}")
            
            if len(participants) == 0:
                logger.info("⚠️ No game participants found - skipping broadcast")
                return
            
            success_count = 0
            for user_id_str in participants.keys():
                # Skip the excluded user if specified
                if exclude_user_id and user_id_str == exclude_user_id:
                    logger.info(f"⏭️ Skipping excluded user: {exclude_user_id}")
                    continue
                    
                try:
                    await self.bot_application.bot.send_message(
                        chat_id=int(user_id_str),
                        text=message
                    )
                    success_count += 1
                    logger.info(f"✅ Message sent successfully to participant {user_id_str} ({participants[user_id_str]})")
                except Exception as e:
                    logger.error(f"❌ Failed to send message to participant {user_id_str} ({participants[user_id_str]}): {e}")
            
            logger.info(f"📊 Broadcast complete: {success_count}/{len(participants)} participants received the message")
        except Exception as e:
            logger.error(f"💥 Error sending to game participants: {e}")
    
    def _broadcast_to_all_users(self, message: str):
        """Broadcast message to all registered users"""
        try:
            loop = self._get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    self._send_to_all_registered_users(message),
                    loop
                )
            else:
                loop.run_until_complete(self._send_to_all_registered_users(message))
            logger.info(f"Broadcast to all users sent: {message}")

        except Exception as e:
            logger.error(f"Error broadcasting to all users: {e}")

    async def _send_to_all_registered_users(self, message: str):
        """Send message to all registered users"""
        try:
            users = db.get_all_users()
            logger.info(f"📢 Broadcasting to {len(users)} registered users: {list(users.keys())}")
            
            if len(users) == 0:
                logger.info("⚠️ No registered users found - skipping broadcast")
                return
            
            success_count = 0
            for user_id_str, nickname in users.items():
                try:
                    await self.bot_application.bot.send_message(
                        chat_id=int(user_id_str),
                        text=message
                    )
                    success_count += 1
                    logger.info(f"✅ Message sent successfully to user {user_id_str} ({nickname})")
                except Exception as e:
                    logger.error(f"❌ Failed to send message to user {user_id_str} ({nickname}): {e}")
            
            logger.info(f"📊 Broadcast to all users complete: {success_count}/{len(users)} users received the message")
        except Exception as e:
            logger.error(f"💥 Error sending to all registered users: {e}")
    
    def _get_event_loop(self):
        """Get the main event loop for the bot application"""
        if self.main_loop is None:
            # Try to get the event loop from the bot application
            try:
                # Get the event loop that the bot application is using
                self.main_loop = asyncio.get_event_loop()
            except RuntimeError:
                # If no event loop exists, create a new one
                self.main_loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self.main_loop)
        return self.main_loop
    
    def get_next_message(self, timeout: float = 1.0) -> Optional[dict]:
        """Get the next message (for compatibility with file_queue interface)"""
        # This method is kept for compatibility but not used in RabbitMQ implementation
        return None
    
    def cleanup_processed_messages(self):
        """Cleanup processed messages (for compatibility with file_queue interface)"""
        # RabbitMQ handles message cleanup automatically
        pass

# Global instance
rabbitmq_consumer = RabbitMQMessageConsumer()
