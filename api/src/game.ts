import { randomInt, randomUUID } from 'crypto';
import { CATEGORIES, QUESTION_BANK } from './questions';

export const MAX_PLAYERS = 8;
export const QUESTION_COUNTS = [5, 10, 15, 20];
export const TIME_LIMITS = [10, 15, 20, 30];

const STARTING_MS = 3000;
const REVEAL_MS = 6000;
const EMPTY_ROOM_TTL_MS = 2 * 60 * 1000;
const AVATARS = ['🐙', '🦈', '🐬', '🐢', '🦀', '🐡', '🦑', '🐳'];
const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

export type Phase = 'lobby' | 'starting' | 'question' | 'reveal' | 'finished';

export interface Settings {
  categories: string[];
  questionCount: number;
  timeLimit: number; // seconds
}

interface DealtQuestion {
  category: string;
  text: string;
  choices: string[];
  correctIdx: number;
}

interface PlayerAnswer {
  choice: number;
  correct: boolean;
  points: number;
}

interface Player {
  id: string;
  token: string;
  name: string;
  avatar: string;
  socketId: string | null;
  score: number;
  streak: number;
  correctCount: number;
  answer: PlayerAnswer | null;
}

interface Room {
  pin: string;
  hostId: string;
  players: Map<string, Player>;
  settings: Settings;
  phase: Phase;
  questions: DealtQuestion[];
  qIndex: number;
  phaseStartedAt: number;
  phaseEndsAt: number;
  timer: NodeJS.Timeout | null;
  cleanupTimer: NodeJS.Timeout | null;
}

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type Session = { pin: string; playerId: string; token: string };

/** Sends a personalised snapshot to one socket. */
export type Emit = (socketId: string, snapshot: unknown) => void;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  return name.length >= 1 && name.length <= 16 ? name : null;
}

function cleanSettings(raw: unknown): Settings | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<Settings>;
  if (!Array.isArray(s.categories)) return null;
  const categories = [...new Set(s.categories)].filter((c) => CATEGORY_IDS.has(c));
  if (categories.length === 0) return null;
  if (!QUESTION_COUNTS.includes(s.questionCount as number)) return null;
  if (!TIME_LIMITS.includes(s.timeLimit as number)) return null;
  return { categories, questionCount: s.questionCount!, timeLimit: s.timeLimit! };
}

/** Picks questions evenly across the chosen categories and shuffles each one's choices. */
function dealQuestions(settings: Settings): DealtQuestion[] {
  const piles = shuffle(settings.categories).map((cat) =>
    shuffle(QUESTION_BANK.filter((q) => q.category === cat)),
  );
  const picked = [];
  while (picked.length < settings.questionCount && piles.some((p) => p.length > 0)) {
    for (const pile of piles) {
      const q = pile.pop();
      if (q && picked.length < settings.questionCount) picked.push(q);
    }
  }
  return shuffle(picked).map((q) => {
    const correct = q.choices[0];
    const choices = shuffle([...q.choices]);
    return { category: q.category, text: q.text, choices, correctIdx: choices.indexOf(correct) };
  });
}

export class GameManager {
  private rooms = new Map<string, Room>();
  private socketIndex = new Map<string, { pin: string; playerId: string }>();

  constructor(private emit: Emit) {}

  createRoom(socketId: string, rawName: unknown, rawSettings: unknown): Result<Session> {
    const name = cleanName(rawName);
    if (!name) return { ok: false, error: 'Pick a name between 1 and 16 characters.' };
    const settings = cleanSettings(rawSettings);
    if (!settings) return { ok: false, error: 'Pick at least one category.' };
    this.detach(socketId);

    let pin: string;
    do pin = String(randomInt(100000, 1000000));
    while (this.rooms.has(pin));

    const room: Room = {
      pin,
      hostId: '',
      players: new Map(),
      settings,
      phase: 'lobby',
      questions: [],
      qIndex: 0,
      phaseStartedAt: Date.now(),
      phaseEndsAt: 0,
      timer: null,
      cleanupTimer: null,
    };
    this.rooms.set(pin, room);
    const player = this.addPlayer(room, socketId, name);
    room.hostId = player.id;
    this.broadcast(room);
    return { ok: true, pin, playerId: player.id, token: player.token };
  }

  joinRoom(socketId: string, rawPin: unknown, rawName: unknown): Result<Session> {
    const name = cleanName(rawName);
    if (!name) return { ok: false, error: 'Pick a name between 1 and 16 characters.' };
    const room = this.rooms.get(String(rawPin ?? '').trim());
    if (!room) return { ok: false, error: 'No game found with that PIN.' };
    if (room.phase !== 'lobby') return { ok: false, error: 'That game has already started.' };
    if (room.players.size >= MAX_PLAYERS) {
      return { ok: false, error: `That game is full (${MAX_PLAYERS} players max).` };
    }
    const taken = [...room.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (taken) return { ok: false, error: 'Someone in that game already has this name.' };
    this.detach(socketId);

    const player = this.addPlayer(room, socketId, name);
    this.broadcast(room);
    return { ok: true, pin: room.pin, playerId: player.id, token: player.token };
  }

  /** Re-attaches a player after a refresh or dropped connection. */
  rejoin(socketId: string, rawPin: unknown, rawToken: unknown): Result<Session> {
    const room = this.rooms.get(String(rawPin ?? ''));
    const player = room && [...room.players.values()].find((p) => p.token === rawToken);
    if (!room || !player) return { ok: false, error: 'That game is no longer available.' };
    this.detach(socketId);
    if (player.socketId) this.socketIndex.delete(player.socketId);
    player.socketId = socketId;
    this.socketIndex.set(socketId, { pin: room.pin, playerId: player.id });
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }
    this.broadcast(room);
    return { ok: true, pin: room.pin, playerId: player.id, token: player.token };
  }

  updateSettings(socketId: string, rawSettings: unknown) {
    const ctx = this.context(socketId);
    const settings = cleanSettings(rawSettings);
    if (!ctx || !settings || ctx.room.phase !== 'lobby' || ctx.room.hostId !== ctx.player.id) return;
    ctx.room.settings = settings;
    this.broadcast(ctx.room);
  }

  start(socketId: string) {
    const ctx = this.context(socketId);
    if (!ctx || ctx.room.phase !== 'lobby' || ctx.room.hostId !== ctx.player.id) return;
    const { room } = ctx;
    room.questions = dealQuestions(room.settings);
    room.qIndex = 0;
    for (const p of room.players.values()) {
      p.score = 0;
      p.streak = 0;
      p.correctCount = 0;
      p.answer = null;
    }
    this.setPhase(room, 'starting', STARTING_MS, () => this.beginQuestion(room));
  }

  answer(socketId: string, rawChoice: unknown) {
    const ctx = this.context(socketId);
    if (!ctx || ctx.room.phase !== 'question' || ctx.player.answer) return;
    const { room, player } = ctx;
    const question = room.questions[room.qIndex];
    const choice = Number(rawChoice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= question.choices.length) return;

    const duration = room.phaseEndsAt - room.phaseStartedAt;
    const elapsed = Math.min(Math.max(Date.now() - room.phaseStartedAt, 0), duration);
    const correct = choice === question.correctIdx;
    // Correct answers earn 500–1000 depending on speed, plus up to 500 for a streak.
    const speedPoints = Math.round(1000 * (1 - elapsed / duration / 2));
    const streakBonus = Math.min(player.streak, 5) * 100;
    player.answer = { choice, correct, points: correct ? speedPoints + streakBonus : 0 };

    if (this.everyoneAnswered(room)) this.endQuestion(room);
    else this.broadcast(room);
  }

  playAgain(socketId: string) {
    const ctx = this.context(socketId);
    if (!ctx || ctx.room.phase !== 'finished' || ctx.room.hostId !== ctx.player.id) return;
    const { room } = ctx;
    for (const p of [...room.players.values()]) {
      if (!p.socketId) room.players.delete(p.id);
      p.score = 0;
      p.streak = 0;
      p.correctCount = 0;
      p.answer = null;
    }
    this.setPhase(room, 'lobby');
  }

  /** Called on explicit leave and on socket disconnect. */
  leave(socketId: string, explicit: boolean) {
    const ctx = this.context(socketId);
    if (!ctx) return;
    const { room, player } = ctx;
    this.socketIndex.delete(socketId);
    player.socketId = null;
    // Mid-game we keep the player (and their score) so they can reconnect.
    if (explicit || room.phase === 'lobby') room.players.delete(player.id);

    const connected = [...room.players.values()].filter((p) => p.socketId);
    if (connected.length === 0) {
      if (room.players.size === 0) return this.destroy(room);
      room.cleanupTimer ??= setTimeout(() => this.destroy(room), EMPTY_ROOM_TTL_MS);
      return;
    }
    if (!room.players.get(room.hostId)?.socketId) room.hostId = connected[0].id;
    if (room.phase === 'question' && this.everyoneAnswered(room)) this.endQuestion(room);
    else this.broadcast(room);
  }

  // ---- internals ----

  private addPlayer(room: Room, socketId: string, name: string): Player {
    const used = new Set([...room.players.values()].map((p) => p.avatar));
    const player: Player = {
      id: randomUUID(),
      token: randomUUID(),
      name,
      avatar: AVATARS.find((a) => !used.has(a)) ?? AVATARS[0],
      socketId,
      score: 0,
      streak: 0,
      correctCount: 0,
      answer: null,
    };
    room.players.set(player.id, player);
    this.socketIndex.set(socketId, { pin: room.pin, playerId: player.id });
    return player;
  }

  private context(socketId: string) {
    const ref = this.socketIndex.get(socketId);
    const room = ref && this.rooms.get(ref.pin);
    const player = room && room.players.get(ref.playerId);
    return room && player ? { room, player } : null;
  }

  /** A socket can only be in one room: drop it from any previous one. */
  private detach(socketId: string) {
    if (this.socketIndex.has(socketId)) this.leave(socketId, true);
  }

  private everyoneAnswered(room: Room) {
    const connected = [...room.players.values()].filter((p) => p.socketId);
    return connected.length > 0 && connected.every((p) => p.answer);
  }

  private setPhase(room: Room, phase: Phase, durationMs = 0, next?: () => void) {
    if (room.timer) clearTimeout(room.timer);
    room.phase = phase;
    room.phaseStartedAt = Date.now();
    room.phaseEndsAt = room.phaseStartedAt + durationMs;
    room.timer = next ? setTimeout(next, durationMs) : null;
    this.broadcast(room);
  }

  private beginQuestion(room: Room) {
    for (const p of room.players.values()) p.answer = null;
    this.setPhase(room, 'question', room.settings.timeLimit * 1000, () => this.endQuestion(room));
  }

  private endQuestion(room: Room) {
    for (const p of room.players.values()) {
      if (p.answer?.correct) {
        p.score += p.answer.points;
        p.streak += 1;
        p.correctCount += 1;
      } else {
        p.streak = 0;
      }
    }
    const isLast = room.qIndex >= room.questions.length - 1;
    this.setPhase(room, 'reveal', REVEAL_MS, () => {
      if (isLast) return this.setPhase(room, 'finished');
      room.qIndex += 1;
      this.beginQuestion(room);
    });
  }

  private destroy(room: Room) {
    if (room.timer) clearTimeout(room.timer);
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    for (const p of room.players.values()) if (p.socketId) this.socketIndex.delete(p.socketId);
    this.rooms.delete(room.pin);
  }

  private broadcast(room: Room) {
    for (const p of room.players.values()) {
      if (p.socketId) this.emit(p.socketId, this.snapshot(room, p));
    }
  }

  /** What one player is allowed to see right now — never the correct answer before the reveal. */
  private snapshot(room: Room, me: Player) {
    const inRound = room.phase === 'question' || room.phase === 'reveal';
    const revealed = room.phase === 'reveal';
    const q = inRound ? room.questions[room.qIndex] : null;
    return {
      pin: room.pin,
      phase: room.phase,
      you: me.id,
      hostId: room.hostId,
      maxPlayers: MAX_PLAYERS,
      settings: room.settings,
      serverNow: Date.now(),
      phaseStartedAt: room.phaseStartedAt,
      phaseEndsAt: room.phaseEndsAt,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        streak: p.streak,
        correctCount: p.correctCount,
        connected: p.socketId !== null,
        answered: inRound && p.answer !== null,
        lastPoints: revealed ? (p.answer?.points ?? 0) : null,
        lastCorrect: revealed ? (p.answer?.correct ?? false) : null,
      })),
      question: q && {
        index: room.qIndex,
        total: room.questions.length,
        category: q.category,
        text: q.text,
        choices: q.choices,
      },
      myAnswer: inRound ? (me.answer?.choice ?? null) : null,
      reveal: q && revealed
        ? {
            correctIdx: q.correctIdx,
            counts: q.choices.map(
              (_, i) => [...room.players.values()].filter((p) => p.answer?.choice === i).length,
            ),
            isLast: room.qIndex >= room.questions.length - 1,
          }
        : null,
    };
  }
}
