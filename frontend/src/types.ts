export interface GameState {
  is_active: boolean;
  started_by: string | null;
  start_time: string | null;
  current_question: number;
  collecting_answers: boolean;
  grading_phase: boolean;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  total_questions: number;
  percentage: number;
}

export interface PlayerStatusResponse {
  gameState: GameState;
  participantCount: number;
  isParticipant: boolean;
  currentAnswer: string | null;
  nickname: string | null;
}

export interface AnswerCellData {
  answer: string;
  is_correct: boolean;
  correct_key: string;
}

export interface AdminUserItem {
  user_id: string;
  nickname: string;
  is_participant: boolean;
}

export interface DashboardData {
  table_data: Array<{
    player: string;
    user_id: string;
    [key: string]: any;
  }>;
  questions: string[];
  game_state: GameState;
  leaderboard: LeaderboardEntry[];
  users: AdminUserItem[];
  player_count: number;
  question_count: number;
  answer_keys?: Record<number, string>;
}
