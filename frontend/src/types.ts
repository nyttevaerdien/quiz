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

export interface PlayerProfile {
  userId: string;
  nickname: string;
  isParticipant: boolean;
  gameState: GameState;
  currentAnswer: string | null;
}

export interface DashboardUserData {
  user_id: string;
  nickname: string;
  is_participant: boolean;
}

export interface DashboardAnswerCell {
  answer: string;
  is_correct: boolean;
  correct_key: string;
}

export interface DashboardRow {
  player: string;
  user_id: string;
  [key: string]: string | DashboardAnswerCell | undefined;
}

export interface DashboardData {
  table_data: DashboardRow[];
  questions: string[];
  game_state: GameState;
  leaderboard: LeaderboardEntry[];
  users: DashboardUserData[];
  player_count: number;
  question_count: number;
}
