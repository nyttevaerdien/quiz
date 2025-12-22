import sqlite3
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

class QuizDatabase:
    def __init__(self, db_path: str = 'db/quiz.db'):
        """Initialize the database connection"""
        self.db_path = db_path
        self.ensure_db_directory()
        self.init_database()
    
    def ensure_db_directory(self):
        """Ensure the db directory exists"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
    
    def init_database(self):
        """Initialize the database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    nickname TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Game participants table - tracks who joined the current game
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS game_participants (
                    user_id TEXT PRIMARY KEY,
                    nickname TEXT NOT NULL,
                    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            ''')
            
            # Game state table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS game_state (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    is_active BOOLEAN DEFAULT FALSE,
                    started_by TEXT,
                    start_time TIMESTAMP,
                    current_question INTEGER DEFAULT 0,
                    collecting_answers BOOLEAN DEFAULT FALSE,
                    grading_phase BOOLEAN DEFAULT FALSE,
                    CONSTRAINT single_row CHECK (id = 1)
                )
            ''')
            
            # Answers table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS answers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    question_number INTEGER NOT NULL,
                    answer_text TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id),
                    UNIQUE(user_id, question_number)
                )
            ''')
            
            # Correct answers table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS correct_answers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    question_number INTEGER NOT NULL,
                    is_correct BOOLEAN DEFAULT FALSE,
                    FOREIGN KEY (user_id) REFERENCES users (user_id),
                    UNIQUE(user_id, question_number)
                )
            ''')
            
            # Add grading_phase column if it doesn't exist (for existing databases)
            try:
                cursor.execute('ALTER TABLE game_state ADD COLUMN grading_phase BOOLEAN DEFAULT FALSE')
            except sqlite3.OperationalError:
                # Column already exists, ignore
                pass
            
            # Initialize game state if not exists
            cursor.execute('SELECT COUNT(*) FROM game_state')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    INSERT INTO game_state (is_active, current_question, collecting_answers, grading_phase)
                    VALUES (FALSE, 0, FALSE, FALSE)
                ''')
            
            conn.commit()
    
    def get_connection(self):
        """Get a database connection"""
        return sqlite3.connect(self.db_path)
    
    # User management
    def add_user(self, user_id: str, nickname: str) -> bool:
        """Add a new user"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO users (user_id, nickname)
                    VALUES (?, ?)
                ''', (user_id, nickname))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding user: {e}")
            return False
    
    def get_user(self, user_id: str) -> Optional[Dict]:
        """Get user by ID"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT user_id, nickname FROM users WHERE user_id = ?', (user_id,))
                row = cursor.fetchone()
                if row:
                    return {'user_id': row[0], 'nickname': row[1]}
                return None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    def get_all_users(self) -> Dict[str, str]:
        """Get all users as {user_id: nickname}"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT user_id, nickname FROM users')
                return {row[0]: row[1] for row in cursor.fetchall()}
        except Exception as e:
            print(f"Error getting all users: {e}")
            return {}
    
    def remove_user(self, user_id: str) -> bool:
        """Remove a user and all their data"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Remove user from all related tables
                cursor.execute('DELETE FROM game_participants WHERE user_id = ?', (user_id,))
                cursor.execute('DELETE FROM answers WHERE user_id = ?', (user_id,))
                cursor.execute('DELETE FROM correct_answers WHERE user_id = ?', (user_id,))
                cursor.execute('DELETE FROM users WHERE user_id = ?', (user_id,))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error removing user {user_id}: {e}")
            return False
    
    def get_game_participants(self) -> Dict[str, str]:
        """Get current game participants as {user_id: nickname}"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT user_id, nickname FROM game_participants')
                return {row[0]: row[1] for row in cursor.fetchall()}
        except Exception as e:
            print(f"Error getting game participants: {e}")
            return {}
    
    def add_game_participant(self, user_id: str, nickname: str) -> bool:
        """Add a user to the current game participants"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO game_participants (user_id, nickname, joined_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                ''', (user_id, nickname))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding game participant {user_id}: {e}")
            return False
    
    def clear_game_participants(self) -> bool:
        """Clear all game participants (when game starts/ends)"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM game_participants')
                conn.commit()
                return True
        except Exception as e:
            print(f"Error clearing game participants: {e}")
            return False
    
    def is_game_participant(self, user_id: str) -> bool:
        """Check if a user is a current game participant"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT 1 FROM game_participants WHERE user_id = ?', (user_id,))
                return cursor.fetchone() is not None
        except Exception as e:
            print(f"Error checking game participant {user_id}: {e}")
            return False
    
    # Game state management
    def get_game_state(self) -> Dict[str, Any]:
        """Get current game state"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT is_active, started_by, start_time, current_question, collecting_answers, grading_phase
                    FROM game_state WHERE id = 1
                ''')
                row = cursor.fetchone()
                if row:
                    return {
                        'is_active': bool(row[0]),
                        'started_by': row[1],
                        'start_time': row[2],
                        'current_question': row[3],
                        'collecting_answers': bool(row[4]),
                        'grading_phase': bool(row[5])
                    }
                return {'is_active': False, 'current_question': 0, 'collecting_answers': False, 'grading_phase': False}
        except Exception as e:
            print(f"Error getting game state: {e}")
            return {'is_active': False, 'current_question': 0, 'collecting_answers': False, 'grading_phase': False}
    
    def update_game_state(self, **kwargs) -> bool:
        """Update game state"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Build dynamic update query
                set_clauses = []
                values = []
                for key, value in kwargs.items():
                    set_clauses.append(f"{key} = ?")
                    values.append(value)
                
                if set_clauses:
                    query = f"UPDATE game_state SET {', '.join(set_clauses)} WHERE id = 1"
                    cursor.execute(query, values)
                    conn.commit()
                return True
        except Exception as e:
            print(f"Error updating game state: {e}")
            return False
    
    def start_game(self, started_by: str = 'admin_web') -> bool:
        """Start a new game"""
        return self.update_game_state(
            is_active=True,
            started_by=started_by,
            start_time=datetime.now().isoformat(),
            current_question=0,
            collecting_answers=False,
            grading_phase=False
        )
    
    def end_game(self) -> bool:
        """End current game"""
        return self.update_game_state(
            is_active=False,
            started_by=None,
            start_time=None,
            current_question=None,
            collecting_answers=False,
            grading_phase=False
        )
    
    def next_question(self) -> bool:
        """Move to next question"""
        current_state = self.get_game_state()
        current_q = current_state.get('current_question', 0)
        return self.update_game_state(
            current_question=current_q + 1,
            collecting_answers=True,
            grading_phase=False
        )
    
    def start_grading_phase(self) -> bool:
        """Start grading phase - stop collecting answers and allow grading"""
        return self.update_game_state(
            collecting_answers=False,
            grading_phase=True
        )
    
    # Answer management
    def save_answer(self, user_id: str, question_number: int, answer_text: str) -> bool:
        """Save user answer"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO answers (user_id, question_number, answer_text)
                    VALUES (?, ?, ?)
                ''', (user_id, question_number, answer_text))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving answer: {e}")
            return False
    
    def get_answers_for_question(self, question_number: int) -> List[Dict]:
        """Get all answers for a specific question"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT a.user_id, u.nickname, a.answer_text, a.timestamp
                    FROM answers a
                    JOIN users u ON a.user_id = u.user_id
                    WHERE a.question_number = ?
                    ORDER BY a.timestamp
                ''', (question_number,))
                
                return [
                    {
                        'user_id': row[0],
                        'nickname': row[1],
                        'answer': row[2],
                        'timestamp': row[3]
                    }
                    for row in cursor.fetchall()
                ]
        except Exception as e:
            print(f"Error getting answers: {e}")
            return []
    
    def get_all_answers(self) -> Dict[str, Dict]:
        """Get all answers organized by question"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT a.question_number, a.user_id, u.nickname, a.answer_text, a.timestamp
                    FROM answers a
                    JOIN users u ON a.user_id = u.user_id
                    ORDER BY a.question_number, a.timestamp
                ''')
                
                answers = {}
                for row in cursor.fetchall():
                    q_num = row[0]
                    question_key = f"question_{q_num}"
                    
                    if question_key not in answers:
                        answers[question_key] = {}
                    
                    answers[question_key][row[1]] = {
                        'nickname': row[2],
                        'answer': row[3],
                        'timestamp': row[4]
                    }
                
                return answers
        except Exception as e:
            print(f"Error getting all answers: {e}")
            return {}
    
    def clear_answers(self) -> bool:
        """Clear all answers"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM answers')
                conn.commit()
                return True
        except Exception as e:
            print(f"Error clearing answers: {e}")
            return False
    
    # Correct answers management
    def toggle_correct_answer(self, user_id: str, question_number: int) -> bool:
        """Toggle correct answer status"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check if answer exists
                cursor.execute('''
                    SELECT is_correct FROM correct_answers 
                    WHERE user_id = ? AND question_number = ?
                ''', (user_id, question_number))
                
                row = cursor.fetchone()
                if row:
                    # Toggle existing
                    new_status = not row[0]
                    cursor.execute('''
                        UPDATE correct_answers SET is_correct = ?
                        WHERE user_id = ? AND question_number = ?
                    ''', (new_status, user_id, question_number))
                else:
                    # Create new
                    cursor.execute('''
                        INSERT INTO correct_answers (user_id, question_number, is_correct)
                        VALUES (?, ?, TRUE)
                    ''', (user_id, question_number))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error toggling correct answer: {e}")
            return False
    
    def get_correct_answers(self) -> Dict[str, bool]:
        """Get all correct answers as {user_id_question_number: is_correct}"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT user_id, question_number, is_correct FROM correct_answers')
                
                return {
                    f"{row[0]}_{row[1]}": bool(row[2])
                    for row in cursor.fetchall()
                }
        except Exception as e:
            print(f"Error getting correct answers: {e}")
            return {}
    
    def clear_correct_answers(self) -> bool:
        """Clear all correct answers"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM correct_answers')
                conn.commit()
                return True
        except Exception as e:
            print(f"Error clearing correct answers: {e}")
            return False
    
    # Leaderboard calculation
    def calculate_leaderboard(self) -> List[Dict]:
        """Calculate leaderboard scores"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get total number of questions in the game (all questions, regardless of player)
                cursor.execute('SELECT COUNT(DISTINCT question_number) FROM answers')
                total_game_questions = cursor.fetchone()[0] or 0
                
                # Get only game participants with their scores
                cursor.execute('''
                    SELECT u.user_id, u.nickname,
                           COUNT(ca.id) as correct_count,
                           COUNT(DISTINCT a.question_number) as answered_questions
                    FROM users u
                    INNER JOIN game_participants gp ON u.user_id = gp.user_id
                    LEFT JOIN answers a ON u.user_id = a.user_id
                    LEFT JOIN correct_answers ca ON u.user_id = ca.user_id 
                        AND a.question_number = ca.question_number 
                        AND ca.is_correct = TRUE
                    GROUP BY u.user_id, u.nickname
                    ORDER BY correct_count DESC, u.nickname ASC
                ''')
                
                leaderboard = []
                for row in cursor.fetchall():
                    user_id, nickname, correct_count, answered_questions = row
                    # Calculate percentage based on total game questions, not just answered questions
                    percentage = round((correct_count / total_game_questions * 100) if total_game_questions > 0 else 0, 1)
                    
                    leaderboard.append({
                        'nickname': nickname,
                        'score': correct_count,
                        'total_questions': total_game_questions,
                        'percentage': percentage
                    })
                
                return leaderboard
        except Exception as e:
            print(f"Error calculating leaderboard: {e}")
            return []
    
    # Backup functionality
    def create_backup(self) -> Optional[str]:
        """Create a backup of all data"""
        try:
            backup_data = {
                'backup_timestamp': datetime.now().isoformat(),
                'game_state': self.get_game_state(),
                'users': self.get_all_users(),
                'answers': self.get_all_answers(),
                'correct_answers': self.get_correct_answers(),
                'leaderboard': self.calculate_leaderboard()
            }
            
            # Create filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"db/backups/{timestamp}_answers.json"
            
            # Ensure backups directory exists
            os.makedirs('db/backups', exist_ok=True)
            
            # Save backup
            with open(backup_filename, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, ensure_ascii=False, indent=2)
            
            print(f"Database backup created: {backup_filename}")
            return backup_filename
            
        except Exception as e:
            print(f"Error creating backup: {e}")
            return None

# Global database instance
db = QuizDatabase()
