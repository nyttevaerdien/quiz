import os
import json
import logging
import time
import pika
import pika.exceptions
from typing import Optional

logger = logging.getLogger(__name__)

class RabbitMQProducerWrapper:
    """RabbitMQ producer wrapper for sending messages"""
    
    def __init__(self, url: str = None, queue: str = None):
        self.url = url or os.getenv('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672/')
        self.queue = queue or os.getenv('RABBITMQ_QUEUE', 'quiz-messages')
        self.connection = None
        self.channel = None
    
    def _connect(self):
        """Connect to RabbitMQ with better connection handling"""
        try:
            # Close existing connection if any
            if self.connection and not self.connection.is_closed:
                try:
                    self.connection.close()
                except:
                    pass
            
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
            logger.info(f"Connected to RabbitMQ at {self.url}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            self.connection = None
            self.channel = None
            return False
    
    def _ensure_connected(self):
        """Ensure connection is established, reconnect if needed"""
        try:
            # Check if connection exists and is open
            if self.connection and self.connection.is_open and self.channel:
                # Try a simple operation to verify connection is alive
                try:
                    self.channel.queue_declare(queue=self.queue, durable=True, passive=True)
                    return True
                except:
                    # Connection appears dead, reconnect
                    logger.warning("RabbitMQ connection appears dead, reconnecting...")
                    return self._connect()
            else:
                # Not connected, try to connect
                logger.info("RabbitMQ not connected, attempting to connect...")
                return self._connect()
        except Exception as e:
            logger.error(f"Error checking RabbitMQ connection: {e}")
            return self._connect()
    
    def send_message(self, message: str, message_type: str = 'broadcast', exclude_user_id: str = None) -> bool:
        """Send a message to RabbitMQ queue"""
        # Ensure we're connected before sending
        if not self._ensure_connected():
            logger.error("RabbitMQ producer could not connect")
            return False
        
        try:
            message_data = {
                'type': message_type,
                'content': message,
                'timestamp': time.time()
            }
            
            # Add exclude_user_id if provided
            if exclude_user_id:
                message_data['exclude_user_id'] = exclude_user_id
            
            self.channel.basic_publish(
                exchange='',
                routing_key=self.queue,
                body=json.dumps(message_data),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                )
            )
            
            logger.info(f"Message sent to queue {self.queue}: {message}")
            return True
            
        except (pika.exceptions.ConnectionClosed, pika.exceptions.ChannelClosed) as e:
            logger.warning(f"Connection lost while sending message, attempting reconnect: {e}")
            # Try to reconnect and resend
            if self._connect():
                try:
                    message_data = {
                        'type': message_type,
                        'content': message,
                        'timestamp': time.time()
                    }
                    if exclude_user_id:
                        message_data['exclude_user_id'] = exclude_user_id
                    
                    self.channel.basic_publish(
                        exchange='',
                        routing_key=self.queue,
                        body=json.dumps(message_data),
                        properties=pika.BasicProperties(
                            delivery_mode=2,  # Make message persistent
                        )
                    )
                    logger.info(f"Message sent to queue {self.queue} after reconnect: {message}")
                    return True
                except Exception as retry_e:
                    logger.error(f"Error sending message after reconnect: {retry_e}")
                    return False
            else:
                logger.error("Failed to reconnect to RabbitMQ")
                return False
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return False
    
    def close(self):
        """Close the connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()

# Global instance
rabbitmq_producer = RabbitMQProducerWrapper()
