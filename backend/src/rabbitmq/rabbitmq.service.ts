import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: any = null;
  private channel: any = null;
  private isConnecting = false;
  private readonly url: string;
  private readonly queue: string;

  constructor() {
    this.url = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672/';
    this.queue = process.env.RABBITMQ_QUEUE || 'quiz-messages';
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch (e: any) {
      this.logger.error(`Error closing RabbitMQ connection: ${e.message}`);
    }
  }

  private async connect(): Promise<boolean> {
    if (this.isConnecting) return false;
    this.isConnecting = true;

    try {
      this.logger.log(`Connecting to RabbitMQ at ${this.url}`);
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertQueue(this.queue, { durable: true });

      this.connection.on('error', (err: any) => {
        this.logger.error(`RabbitMQ connection error: ${err.message}`);
        this.connection = null;
        this.channel = null;
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed, will attempt to reconnect on next send');
        this.connection = null;
        this.channel = null;
      });

      this.logger.log(`Connected to RabbitMQ queue: ${this.queue}`);
      this.isConnecting = false;
      return true;
    } catch (err: any) {
      this.logger.warn(`Could not connect to RabbitMQ: ${err.message}. Messages will be skipped.`);
      this.connection = null;
      this.channel = null;
      this.isConnecting = false;
      return false;
    }
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.connection && this.channel) {
      return true;
    }
    return await this.connect();
  }

  async sendMessage(message: string, messageType: string = 'broadcast', excludeUserId?: string): Promise<boolean> {
    try {
      const connected = await this.ensureConnected();
      if (!connected || !this.channel) {
        this.logger.warn(`RabbitMQ not available, skipping message: "${message}"`);
        return false;
      }

      const payload: any = {
        type: messageType,
        content: message,
        timestamp: Date.now() / 1000,
      };

      if (excludeUserId) {
        payload.exclude_user_id = excludeUserId;
      }

      const buffer = Buffer.from(JSON.stringify(payload));
      const sent = this.channel.sendToQueue(this.queue, buffer, { persistent: true });
      if (sent) {
        this.logger.log(`Sent to RabbitMQ [${messageType}]: "${message}"`);
      }
      return sent;
    } catch (err: any) {
      this.logger.error(`Error sending message to RabbitMQ: ${err.message}`);
      this.connection = null;
      this.channel = null;
      return false;
    }
  }

  async sendBroadcast(message: string, excludeUserId?: string): Promise<boolean> {
    return this.sendMessage(message, 'broadcast', excludeUserId);
  }

  async sendBroadcastAllUsers(message: string): Promise<boolean> {
    return this.sendMessage(message, 'broadcast_all_users');
  }
}
