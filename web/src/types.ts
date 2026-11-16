export type Phase = 'lobby' | 'starting' | 'question' | 'reveal' | 'finished'

export interface Settings {
  categories: string[]
  questionCount: number
  timeLimit: number
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  questionCount: number
}

export interface Config {
  maxPlayers: number
  questionCounts: number[]
  timeLimits: number[]
  categories: Category[]
}

export interface PlayerView {
  id: string
  name: string
  avatar: string
  score: number
  streak: number
  correctCount: number
  connected: boolean
  answered: boolean
  lastPoints: number | null
  lastCorrect: boolean | null
}

export interface GameState {
  pin: string
  phase: Phase
  you: string
  hostId: string
  maxPlayers: number
  settings: Settings
  serverNow: number
  phaseStartedAt: number
  phaseEndsAt: number
  players: PlayerView[]
  question: {
    index: number
    total: number
    category: string
    text: string
    choices: string[]
  } | null
  myAnswer: number | null
  reveal: { correctIdx: number; counts: number[]; isLast: boolean } | null
}

export type JoinResult =
  | { ok: true; pin: string; playerId: string; token: string }
  | { ok: false; error: string }
