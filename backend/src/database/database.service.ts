import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');
type DatabaseType = any;

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
      // Look for db in ../db/quiz.db or ./db/quiz.db
      const rootDbPath = path.resolve(process.cwd(), '..', 'db', 'quiz.db');
      const localDbPath = path.resolve(process.cwd(), 'db', 'quiz.db');
      if (fs.existsSync(rootDbPath) || fs.existsSync(path.dirname(rootDbPath))) {
        this.dbPath = rootDbPath;
      } else {
        this.dbPath = localDbPath;
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

    // Try adding grading_phase column if missing
    try {
      this.db.exec('ALTER TABLE game_state ADD COLUMN grading_phase BOOLEAN DEFAULT FALSE;');
    } catch {
      // Column already exists
    }

    // Ensure single game_state row exists
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM game_state').get() as { count: number };
    if (countRow.count === 0) {
      this.db.prepare(`
        INSERT INTO game_state (id, is_active, current_question, collecting_answers, grading_phase)
        VALUES (1, 0, 0, 0, 0)
      `).run();
    }
  }

  // --- User Management ---

  addUser(userId: string, nickname: string): boolean {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO users (user_id, nickname)
        VALUES (?, ?)
      `).run(userId, nickname);
      return true;
    } catch (err) {
      this.logger.error(`Error adding user: ${err.message}`);
      return false;
    }
  }

  getUser(userId: string): User | null {
    try {
      const row = this.db.prepare('SELECT user_id, nickname, created_at FROM users WHERE user_id = ?').get(userId) as any;
      if (!row) return null;
      return { user_id: row.user_id, nickname: row.nickname, created_at: row.created_at };
    } catch (err) {
      this.logger.error(`Error getting user: ${err.message}`);
      return null;
    }
  }

  getUserByNickname(nickname: string): User | null {
    try {
      const row = this.db.prepare('SELECT user_id, nickname, created_at FROM users WHERE LOWER(nickname) = LOWER(?)').get(nickname) as any;
      if (!row) return null;
      return { user_id: row.user_id, nickname: row.nickname, created_at: row.created_at };
    } catch (err) {
      this.logger.error(`Error getting user by nickname: ${err.message}`);
      return null;
    }
  }

  getAllUsers(): Record<string, string> {
    try {
      const rows = this.db.prepare('SELECT user_id, nickname FROM users').all() as any[];
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.user_id] = row.nickname;
      }
      return map;
    } catch (err) {
      this.logger.error(`Error getting all users: ${err.message}`);
      return {};
    }
  }

  removeUser(userId: string): boolean {
    try {
      const deleteTransaction = this.db.transaction(() => {
        this.db.prepare('DELETE FROM game_participants WHERE user_id = ?').run(userId);
        this.db.prepare('DELETE FROM answers WHERE user_id = ?').run(userId);
        this.db.prepare('DELETE FROM correct_answers WHERE user_id = ?').run(userId);
        this.db.prepare('DELETE FROM users WHERE user_id = ?').run(userId);
      });
      deleteTransaction();
      return true;
    } catch (err) {
      this.logger.error(`Error removing user ${userId}: ${err.message}`);
      return false;
    }
  }

  // --- Game Participants ---

  getGameParticipants(): Record<string, string> {
    try {
      const rows = this.db.prepare('SELECT user_id, nickname FROM game_participants').all() as any[];
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.user_id] = row.nickname;
      }
      return map;
    } catch (err) {
      this.logger.error(`Error getting game participants: ${err.message}`);
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
    } catch (err) {
      this.logger.error(`Error adding game participant: ${err.message}`);
      return false;
    }
  }

  clearGameParticipants(): boolean {
    try {
      this.db.prepare('DELETE FROM game_participants').run();
      return true;
    } catch (err) {
      this.logger.error(`Error clearing game participants: ${err.message}`);
      return false;
    }
  }

  isGameParticipant(userId: string): boolean {
    try {
      const row = this.db.prepare('SELECT 1 FROM game_participants WHERE user_id = ?').get(userId);
      return !!row;
    } catch (err) {
      this.logger.error(`Error checking participant: ${err.message}`);
      return false;
    }
  }

  // --- Game State Management ---

  getGameState(): GameState {
    try {
      const row = this.db.prepare(`
        SELECT is_active, started_by, start_time, current_question, collecting_answers, grading_phase
        FROM game_state WHERE id = 1
      `).get() as any;

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
    } catch (err) {
      this.logger.error(`Error getting game state: ${err.message}`);
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

  updateGameState(updates: Partial<{
    is_active: boolean;
    started_by: string | null;
    start_time: string | null;
    current_question: number | null;
    collecting_answers: boolean;
    grading_phase: boolean;
  }>): boolean {
    try {
      const keys = Object.keys(updates);
      if (keys.length === 0) return true;

      const setClauses = keys.map(k => `${k} = ?`).join(', ');
      const values = keys.map(k => {
        const val = (updates as any)[k];
        if (typeof val === 'boolean') return val ? 1 : 0;
        return val;
      });

      this.db.prepare(`UPDATE game_state SET ${setClauses} WHERE id = 1`).run(...values);
      return true;
    } catch (err) {
      this.logger.error(`Error updating game state: ${err.message}`);
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
    const state = this.getGameState();
    const nextQ = (state.current_question || 0) + 1;
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

  // --- Answers Management ---

  saveAnswer(userId: string, questionNumber: number, answerText: string): boolean {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO answers (user_id, question_number, answer_text, timestamp)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(userId, questionNumber, answerText.trim());
      return true;
    } catch (err) {
      this.logger.error(`Error saving answer: ${err.message}`);
      return false;
    }
  }

  getUserAnswerForQuestion(userId: string, questionNumber: number): string | null {
    try {
      const row = this.db.prepare(`
        SELECT answer_text FROM answers WHERE user_id = ? AND question_number = ?
      `).get(userId, questionNumber) as any;
      return row ? row.answer_text : null;
    } catch (err) {
      this.logger.error(`Error getting user answer: ${err.message}`);
      return null;
    }
  }

  getAnswersForQuestion(questionNumber: number): AnswerItem[] {
    try {
      const rows = this.db.prepare(`
        SELECT a.user_id, u.nickname, a.answer_text, a.timestamp
        FROM answers a
        JOIN users u ON a.user_id = u.user_id
        WHERE a.question_number = ?
        ORDER BY a.timestamp
      `).all(questionNumber) as any[];

      return rows.map(r => ({
        user_id: r.user_id,
        nickname: r.nickname,
        answer: r.answer_text,
        timestamp: r.timestamp,
      }));
    } catch (err) {
      this.logger.error(`Error getting answers for question ${questionNumber}: ${err.message}`);
      return [];
    }
  }

  getAllAnswers(): Record<string, Record<string, { nickname: string; answer: string; timestamp: string }>> {
    try {
      const rows = this.db.prepare(`
        SELECT a.question_number, a.user_id, u.nickname, a.answer_text, a.timestamp
        FROM answers a
        JOIN users u ON a.user_id = u.user_id
        ORDER BY a.question_number, a.timestamp
      `).all() as any[];

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
    } catch (err) {
      this.logger.error(`Error getting all answers: ${err.message}`);
      return {};
    }
  }

  clearAnswers(): boolean {
    try {
      this.db.prepare('DELETE FROM answers').run();
      return true;
    } catch (err) {
      this.logger.error(`Error clearing answers: ${err.message}`);
      return false;
    }
  }

  // --- Correct Answers ---

  toggleCorrectAnswer(userId: string, questionNumber: number): { success: boolean; is_correct: boolean } {
    try {
      const row = this.db.prepare(`
        SELECT is_correct FROM correct_answers
        WHERE user_id = ? AND question_number = ?
      `).get(userId, questionNumber) as any;

      if (row) {
        const newStatus = !Boolean(row.is_correct);
        this.db.prepare(`
          UPDATE correct_answers SET is_correct = ?
          WHERE user_id = ? AND question_number = ?
        `).run(newStatus ? 1 : 0, userId, questionNumber);
        return { success: true, is_correct: newStatus };
      } else {
        this.db.prepare(`
          INSERT INTO correct_answers (user_id, question_number, is_correct)
          VALUES (?, ?, 1)
        `).run(userId, questionNumber);
        return { success: true, is_correct: true };
      }
    } catch (err) {
      this.logger.error(`Error toggling correct answer: ${err.message}`);
      return { success: false, is_correct: false };
    }
  }

  getCorrectAnswers(): Record<string, boolean> {
    try {
      const rows = this.db.prepare('SELECT user_id, question_number, is_correct FROM correct_answers').all() as any[];
      const map: Record<string, boolean> = {};
      for (const r of rows) {
        map[`${r.user_id}_${r.question_number}`] = Boolean(r.is_correct);
      }
      return map;
    } catch (err) {
      this.logger.error(`Error getting correct answers: ${err.message}`);
      return {};
    }
  }

  clearCorrectAnswers(): boolean {
    try {
      this.db.prepare('DELETE FROM correct_answers').run();
      return true;
    } catch (err) {
      this.logger.error(`Error clearing correct answers: ${err.message}`);
      return false;
    }
  }

  // --- Leaderboard Calculation ---

  calculateLeaderboard(): LeaderboardEntry[] {
    try {
      const countRow = this.db.prepare('SELECT COUNT(DISTINCT question_number) as total FROM answers').get() as any;
      const totalGameQuestions = countRow?.total || 0;

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
      `).all() as any[];

      return rows.map(r => {
        const correctCount = r.correct_count || 0;
        const percentage = totalGameQuestions > 0 ? Math.round((correctCount / totalGameQuestions) * 1000) / 10 : 0;
        return {
          nickname: r.nickname,
          score: correctCount,
          total_questions: totalGameQuestions,
          percentage,
        };
      });
    } catch (err) {
      this.logger.error(`Error calculating leaderboard: ${err.message}`);
      return [];
    }
  }

  // --- Backup Creation ---

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

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      
      const backupsDir = path.resolve(path.dirname(this.dbPath), 'backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const backupFilePath = path.join(backupsDir, `${timestamp}_answers.json`);
      fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
      this.logger.log(`Database backup created: ${backupFilePath}`);
      return backupFilePath;
    } catch (err) {
      this.logger.error(`Error creating backup: ${err.message}`);
      return null;
    }
  }
}
