export interface User {
  id: string;
  email: string;
  pseudo: string;
  avatar?: string;
  balance: number;
  role: 'PLAYER' | 'VIP' | 'ADMIN';
  grade: 'NONE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
  avatarBorder?: string;
  pseudoColor?: string;
  xp?: number;
  level?: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  pseudo: string;
  avatar?: string;
  grade: string;
  pseudoColor?: string;
  content: string;
  createdAt: string;
}

export interface CrashBet {
  userId: string;
  pseudo: string;
  amount: number;
  cashedOut: boolean;
}

export interface CrashState {
  state: 'waiting' | 'running' | 'crashed';
  multiplier: number;
  bets: CrashBet[];
  history: number[];
  waitTime?: number;
}

export interface RouletteBetItem {
  type: 'number' | 'color' | 'even_odd' | 'dozen' | 'half' | 'column';
  value: string | number;
  amount: number;
}

export interface RoulettePlayerBet {
  userId: string;
  pseudo: string;
  bets: RouletteBetItem[];
}

export interface RouletteState {
  state: 'betting' | 'spinning' | 'result';
  countdown: number;
  bets: RoulettePlayerBet[];
  history: { number: number; color: string }[];
}

export interface SlotResult {
  reels: { id: string; emoji: string }[];
  multiplier: number;
  winAmount: number;
  winType: string | null;
  won: boolean;
  newBalance: number;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: 'GRADE' | 'AVATAR_BORDER' | 'PSEUDO_COLOR';
  value: string;
  price: number;
}

export interface LeaderboardUser {
  id: string;
  pseudo: string;
  avatar?: string;
  balance: number;
  grade: string;
  avatarBorder?: string;
  pseudoColor?: string;
}
