import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import Database = require('better-sqlite3');

export interface User {
  user_id: string;
  nickname: string;
  created_at?: string;
}

export interface GameParticipant {
  user_id: string;
  nickname: string;
  joined_at?: string;
}

export interface GameState {
  is_active: boolean;
  started_by: string | null;
  start_time: string | null;
  current_question: number;
  collecting_answers: boolean;
  grading_phase: boolean;
}

export interface AnswerItem {
  user_id: string;
  nickname: string;
  answer: string;
  timestamp: string;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  total_questions: number;
  percentage: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: any;
  private dbPath: string;

  constructor() {
    const envPath = process.env.DATABASE_PATH;
    if (envPath) {
      this.dbPath = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
    } else {
      const rootDbPath = path.resolve(process.cwd(), 'db', 'quiz.db');
      const parentDbPath = path.resolve(process.cwd(), '..', 'db', 'quiz.db');
      if (fs.existsSync(rootDbPath) || fs.existsSync(path.dirname(rootDbPath))) {
        this.dbPath = rootDbPath;
      } else if (fs.existsSync(parentDbPath)) {
        this.dbPath = parentDbPath;
      } else {
        this.dbPath = rootDbPath;
      }
    }
  }

  onModuleInit() {
    this.ensureDbDirectory();
    this.initDatabase();
  }

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
    }
  }

  private ensureDbDirectory() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private initDatabase() {
    this.logger.log(`Initializing SQLite database at: ${this.dbPath}`);
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Game participants table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_participants (
        user_id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id)
      );
    `);

    // Game state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        is_active BOOLEAN DEFAULT FALSE,
        started_by TEXT,
        start_time TIMESTAMP,
        current_question INTEGER DEFAULT 0,
        collecting_answers BOOLEAN DEFAULT FALSE,
        grading_phase BOOLEAN DEFAULT FALSE,
        CONSTRAINT single_row CHECK (id = 1)
      );
    `);

    // Answers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        question_number INTEGER NOT NULL,
        answer_text TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id),
        UNIQUE(user_id, question_number)
      );
    `);

    // Correct answers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS correct_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        question_number INTEGER NOT NULL,
        is_correct BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users (user_id),
        UNIQUE(user_id, question_number)
      );
    `);

    // Question answer keys table (predefined correct answers by question number)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS question_answer_keys (
        question_number INTEGER PRIMARY KEY,
        correct_answer TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure row exists in game_state
    const count = this.db.prepare('SELECT COUNT(*) as count FROM game_state').get().count;
    if (count === 0) {
      this.db.prepare(`
        INSERT INTO game_state (id, is_active, current_question, collecting_answers, grading_phase)
        VALUES (1, 0, 0, 0, 0)
      `).run();
    }
  }

  // --- Users ---
  addUser(userId: string, nickname: string): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO users (user_id, nickname)
        VALUES (?, ?)
      `);
      stmt.run(userId, nickname);
      return true;
    } catch (e: any) {
      this.logger.error(`Error adding user: ${e.message}`);
      return false;
    }
  }

  getUser(userId: string): User | null {
    try {
      const row = this.db.prepare('SELECT user_id, nickname, created_at FROM users WHERE user_id = ?').get(userId);
      return row || null;
    } catch (e: any) {
      this.logger.error(`Error getting user: ${e.message}`);
      return null;
    }
  }

  getAllUsers(): Record<string, string> {
    try {
      const rows = this.db.prepare('SELECT user_id, nickname FROM users').all();
      const result: Record<string, string> = {};
      for (const r of rows) {
        result[r.user_id] = r.nickname;
      }
      return result;
    } catch (e: any) {
      this.logger.error(`Error getting all users: ${e.message}`);
      return {};
    }
  }

  removeUser(userId: string): boolean {
    try {
      const delParticipants = this.db.prepare('DELETE FROM game_participants WHERE user_id = ?');
      const delAnswers = this.db.prepare('DELETE FROM answers WHERE user_id = ?');
      const delCorrect = this.db.prepare('DELETE FROM correct_answers WHERE user_id = ?');
      const delUser = this.db.prepare('DELETE FROM users WHERE user_id = ?');

      const tx = this.db.transaction(() => {
        delParticipants.run(userId);
        delAnswers.run(userId);
        delCorrect.run(userId);
        delUser.run(userId);
      });
      tx();
      return true;
    } catch (e: any) {
      this.logger.error(`Error removing user ${userId}: ${e.message}`);
      return false;
    }
  }

  // --- Participants ---
  getGameParticipants(): Record<string, string> {
    try {
      const rows = this.db.prepare('SELECT user_id, nickname FROM game_participants').all();
      const result: Record<string, string> = {};
      for (const r of rows) {
        result[r.user_id] = r.nickname;
      }
      return result;
    } catch (e: any) {
      this.logger.error(`Error getting participants: ${e.message}`);
      return {};
    }
  }

  addGameParticipant(userId: string, nickname: string): boolean {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO game_participants (user_id, nickname, joined_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run(userId, nickname);
      return true;
    } catch (e: any) {
      this.logger.error(`Error adding participant: ${e.message}`);
      return false;
    }
  }

  clearGameParticipants(): boolean {
    try {
      this.db.prepare('DELETE FROM game_participants').run();
      return true;
    } catch (e: any) {
      this.logger.error(`Error clearing participants: ${e.message}`);
      return false;
    }
  }

  isGameParticipant(userId: string): boolean {
    try {
      const row = this.db.prepare('SELECT 1 FROM game_participants WHERE user_id = ?').get(userId);
      return !!row;
    } catch (e: any) {
      this.logger.error(`Error checking participant: ${e.message}`);
      return false;
    }
  }

  // --- Game State ---
  getGameState(): GameState {
    try {
      const row = this.db.prepare(`
        SELECT is_active, started_by, start_time, current_question, collecting_answers, grading_phase
        FROM game_state WHERE id = 1
      `).get();

      if (row) {
        return {
          is_active: Boolean(row.is_active),
          started_by: row.started_by,
          start_time: row.start_time,
          current_question: row.current_question || 0,
          collecting_answers: Boolean(row.collecting_answers),
          grading_phase: Boolean(row.grading_phase),
        };
      }
      return {
        is_active: false,
        started_by: null,
        start_time: null,
        current_question: 0,
        collecting_answers: false,
        grading_phase: false,
      };
    } catch (e: any) {
      this.logger.error(`Error getting game state: ${e.message}`);
      return {
        is_active: false,
        started_by: null,
        start_time: null,
        current_question: 0,
        collecting_answers: false,
        grading_phase: false,
      };
    }
  }

  updateGameState(fields: Partial<GameState>): boolean {
    try {
      const keys = Object.keys(fields);
      if (keys.length === 0) return true;

      const setClauses: string[] = [];
      const values: any[] = [];

      for (const k of keys) {
        setClauses.push(`${k} = ?`);
        let val = (fields as any)[k];
        if (typeof val === 'boolean') {
          val = val ? 1 : 0;
        }
        values.push(val);
      }

      const sql = `UPDATE game_state SET ${setClauses.join(', ')} WHERE id = 1`;
      this.db.prepare(sql).run(...values);
      return true;
    } catch (e: any) {
      this.logger.error(`Error updating game state: ${e.message}`);
      return false;
    }
  }

  startGame(startedBy: string = 'admin_web'): boolean {
    return this.updateGameState({
      is_active: true,
      started_by: startedBy,
      start_time: new Date().toISOString(),
      current_question: 0,
      collecting_answers: false,
      grading_phase: false,
    });
  }

  endGame(): boolean {
    return this.updateGameState({
      is_active: false,
      started_by: null,
      start_time: null,
      current_question: 0,
      collecting_answers: false,
      grading_phase: false,
    });
  }

  nextQuestion(): boolean {
    const current = this.getGameState();
    const nextQ = (current.current_question || 0) + 1;
    return this.updateGameState({
      current_question: nextQ,
      collecting_answers: true,
      grading_phase: false,
    });
  }

  startGradingPhase(): boolean {
    return this.updateGameState({
      collecting_answers: false,
      grading_phase: true,
    });
  }

  // --- Answers ---
  saveAnswer(userId: string, questionNumber: number, answerText: string): boolean {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO answers (user_id, question_number, answer_text, timestamp)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(userId, questionNumber, answerText);
      return true;
    } catch (e: any) {
      this.logger.error(`Error saving answer: ${e.message}`);
      return false;
    }
  }

  getUserAnswerForQuestion(userId: string, questionNumber: number): string | null {
    try {
      const row = this.db.prepare(`
        SELECT answer_text FROM answers
        WHERE user_id = ? AND question_number = ?
      `).get(userId, questionNumber);
      return row ? row.answer_text : null;
    } catch (e: any) {
      this.logger.error(`Error getting user answer: ${e.message}`);
      return null;
    }
  }

  getAllAnswers(): Record<string, Record<string, { nickname: string; answer: string; timestamp: string }>> {
    try {
      const rows = this.db.prepare(`
        SELECT a.question_number, a.user_id, u.nickname, a.answer_text, a.timestamp
        FROM answers a
        JOIN users u ON a.user_id = u.user_id
        ORDER BY a.question_number, a.timestamp
      `).all();

      const answers: Record<string, Record<string, { nickname: string; answer: string; timestamp: string }>> = {};
      for (const row of rows) {
        const qKey = `question_${row.question_number}`;
        if (!answers[qKey]) {
          answers[qKey] = {};
        }
        answers[qKey][row.user_id] = {
          nickname: row.nickname,
          answer: row.answer_text,
          timestamp: row.timestamp,
        };
      }
      return answers;
    } catch (e: any) {
      this.logger.error(`Error getting all answers: ${e.message}`);
      return {};
    }
  }

  clearAnswers(): boolean {
    try {
      this.db.prepare('DELETE FROM answers').run();
      return true;
    } catch (e: any) {
      this.logger.error(`Error clearing answers: ${e.message}`);
      return false;
    }
  }

  // --- Correct Answers ---
  toggleCorrectAnswer(userId: string, questionNumber: number): { success: boolean; is_correct?: boolean } {
    try {
      const row = this.db.prepare(`
        SELECT is_correct FROM correct_answers
        WHERE user_id = ? AND question_number = ?
      `).get(userId, questionNumber);

      let newStatus = true;
      if (row) {
        newStatus = !row.is_correct;
        this.db.prepare(`
          UPDATE correct_answers SET is_correct = ?
          WHERE user_id = ? AND question_number = ?
        `).run(newStatus ? 1 : 0, userId, questionNumber);
      } else {
        this.db.prepare(`
          INSERT INTO correct_answers (user_id, question_number, is_correct)
          VALUES (?, ?, 1)
        `).run(userId, questionNumber);
      }
      return { success: true, is_correct: newStatus };
    } catch (e: any) {
      this.logger.error(`Error toggling correct answer: ${e.message}`);
      return { success: false };
    }
  }

  getCorrectAnswers(): Record<string, boolean> {
    try {
      const rows = this.db.prepare('SELECT user_id, question_number, is_correct FROM correct_answers').all();
      const result: Record<string, boolean> = {};
      for (const r of rows) {
        result[`${r.user_id}_${r.question_number}`] = Boolean(r.is_correct);
      }
      return result;
    } catch (e: any) {
      this.logger.error(`Error getting correct answers: ${e.message}`);
      return {};
    }
  }

  clearCorrectAnswers(): boolean {
    try {
      this.db.prepare('DELETE FROM correct_answers').run();
      return true;
    } catch (e: any) {
      this.logger.error(`Error clearing correct answers: ${e.message}`);
      return false;
    }
  }

  // --- Question Answer Keys (Auto-check) ---
  setQuestionAnswerKey(questionNumber: number, correctAnswer: string): boolean {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO question_answer_keys (question_number, correct_answer)
        VALUES (?, ?)
      `).run(questionNumber, correctAnswer.trim());
      return true;
    } catch (e: any) {
      this.logger.error(`Error saving answer key for question ${questionNumber}: ${e.message}`);
      return false;
    }
  }

  deleteQuestionAnswerKey(questionNumber: number): boolean {
    try {
      this.db.prepare('DELETE FROM question_answer_keys WHERE question_number = ?').run(questionNumber);
      return true;
    } catch (e: any) {
      this.logger.error(`Error deleting answer key for question ${questionNumber}: ${e.message}`);
      return false;
    }
  }

  getQuestionAnswerKeys(): Record<number, string> {
    try {
      const rows = this.db.prepare('SELECT question_number, correct_answer FROM question_answer_keys ORDER BY question_number').all();
      const keys: Record<number, string> = {};
      for (const row of rows) {
        keys[row.question_number] = row.correct_answer;
      }
      return keys;
    } catch (e: any) {
      this.logger.error(`Error getting question answer keys: ${e.message}`);
      return {};
    }
  }

  getQuestionAnswerKey(questionNumber: number): string | null {
    try {
      const row = this.db.prepare('SELECT correct_answer FROM question_answer_keys WHERE question_number = ?').get(questionNumber);
      return row ? row.correct_answer : null;
    } catch (e: any) {
      this.logger.error(`Error getting answer key for question ${questionNumber}: ${e.message}`);
      return null;
    }
  }

  setCorrectAnswerStatus(userId: string, questionNumber: number, isCorrect: boolean): boolean {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO correct_answers (user_id, question_number, is_correct)
        VALUES (?, ?, ?)
      `).run(userId, questionNumber, isCorrect ? 1 : 0);
      return true;
    } catch (e: any) {
      this.logger.error(`Error setting correct answer status: ${e.message}`);
      return false;
    }
  }

  // --- Leaderboard ---
  calculateLeaderboard(): LeaderboardEntry[] {
    try {
      const qCountRow = this.db.prepare('SELECT COUNT(DISTINCT question_number) as cnt FROM answers').get();
      const totalQuestions = qCountRow ? qCountRow.cnt : 0;

      const rows = this.db.prepare(`
        SELECT u.user_id, u.nickname,
               COUNT(ca.id) as correct_count,
               COUNT(DISTINCT a.question_number) as answered_questions
        FROM users u
        INNER JOIN game_participants gp ON u.user_id = gp.user_id
        LEFT JOIN answers a ON u.user_id = a.user_id
        LEFT JOIN correct_answers ca ON u.user_id = ca.user_id 
            AND a.question_number = ca.question_number 
            AND ca.is_correct = 1
        GROUP BY u.user_id, u.nickname
        ORDER BY correct_count DESC, u.nickname ASC
      `).all();

      return rows.map((r: any) => {
        const percentage = totalQuestions > 0 ? Math.round((r.correct_count / totalQuestions) * 1000) / 10 : 0;
        return {
          nickname: r.nickname,
          score: r.correct_count,
          total_questions: totalQuestions,
          percentage,
        };
      });
    } catch (e: any) {
      this.logger.error(`Error calculating leaderboard: ${e.message}`);
      return [];
    }
  }

  // --- Backups ---
  createBackup(): string | null {
    try {
      const backupData = {
        backup_timestamp: new Date().toISOString(),
        game_state: this.getGameState(),
        users: this.getAllUsers(),
        answers: this.getAllAnswers(),
        correct_answers: this.getCorrectAnswers(),
        leaderboard: this.calculateLeaderboard(),
      };

      const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const backupDir = path.resolve(path.dirname(this.dbPath), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const backupFilename = path.join(backupDir, `${dateStr}_answers.json`);
      fs.writeFileSync(backupFilename, JSON.stringify(backupData, null, 2), 'utf-8');
      this.logger.log(`Database backup created: ${backupFilename}`);
      return backupFilename;
    } catch (e: any) {
      this.logger.error(`Error creating backup: ${e.message}`);
      return null;
    }
  }
}
