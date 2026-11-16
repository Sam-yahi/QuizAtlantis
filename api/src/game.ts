import { randomInt, randomUUID } from 'crypto';
import { CATEGORIES, QUESTION_BANK } from './questions';
import type { Store } from './store';

export const MAX_PLAYERS = 8;
export const QUESTION_COUNTS = [5, 10, 15, 20];
export const TIME_LIMITS = [10, 15, 20, 30];

const STARTING_MS = 3000;
const REVEAL_MS = 6000;
/** Clients poll at least every 2s; after this long without a poll a player shows as offline. */
const OFFLINE_AFTER_MS = 6000;
/** After this long without a poll a player is dropped from the lobby / loses host. */
const GONE_AFTER_MS = 20000;
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

interface Player {
  id: string;
  /** Secret that identifies this player's requests. Never sent to other players. */
  token: string;
  name: string;
  avatar: string;
  joinedAt: number;
  score: number;
  streak: number;
  correctCount: number;
  answer: { choice: number; correct: boolean; points: number } | null;
}

/** Everything about a game. Stored as one JSON document; nothing lives in process memory. */
interface Room {
  version: number;
  pin: string;
  hostId: string;
  players: Player[];
  settings: Settings;
  phase: Phase;
  questions: DealtQuestion[];
  qIndex: number;
  phaseStartedAt: number;
  phaseEndsAt: number;
}

type Seen = Record<string, number>;
export type Snapshot = ReturnType<typeof snapshot>;
export type EnterResult =
  | { ok: true; pin: string; token: string; state: Snapshot }
  | { ok: false; error: string };

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

function newPlayer(room: Room, name: string, now: number): Player {
  const used = new Set(room.players.map((p) => p.avatar));
  return {
    id: randomUUID(),
    token: randomUUID(),
    name,
    avatar: AVATARS.find((a) => !used.has(a)) ?? AVATARS[0],
    joinedAt: now,
    score: 0,
    streak: 0,
    correctCount: 0,
    answer: null,
  };
}

function resetScores(room: Room) {
  for (const p of room.players) {
    p.score = 0;
    p.streak = 0;
    p.correctCount = 0;
    p.answer = null;
  }
}

function setPhase(room: Room, phase: Phase, startsAt: number, durationMs = 0) {
  room.phase = phase;
  room.phaseStartedAt = startsAt;
  room.phaseEndsAt = startsAt + durationMs;
}

function beginQuestion(room: Room, at: number) {
  for (const p of room.players) p.answer = null;
  setPhase(room, 'question', at, room.settings.timeLimit * 1000);
}

function endQuestion(room: Room, at: number) {
  for (const p of room.players) {
    if (p.answer?.correct) {
      p.score += p.answer.points;
      p.streak += 1;
      p.correctCount += 1;
    } else {
      p.streak = 0;
    }
  }
  setPhase(room, 'reveal', at, REVEAL_MS);
}

/**
 * Brings a room up to date with the clock. There are no server timers: every request
 * calls this first, and it applies whatever phase changes are due. Timed phases start
 * exactly when the previous one was scheduled to end, however late the request arrives.
 */
function advance(room: Room, seen: Seen, now: number) {
  const lastSeen = (p: Player) => Math.max(seen[p.token] ?? 0, p.joinedAt);
  const online = (p: Player) => now - lastSeen(p) < OFFLINE_AFTER_MS;
  const gone = (p: Player) => now - lastSeen(p) > GONE_AFTER_MS;

  if (room.phase === 'lobby') {
    const staying = room.players.filter((p) => !gone(p));
    if (staying.length > 0) room.players = staying;
  }
  const host = room.players.find((p) => p.id === room.hostId);
  if (!host || gone(host)) {
    room.hostId = (room.players.find(online) ?? room.players[0]).id;
  }

  for (;;) {
    const due = now >= room.phaseEndsAt;
    if (room.phase === 'starting' && due) {
      beginQuestion(room, room.phaseEndsAt);
    } else if (room.phase === 'question' && due) {
      endQuestion(room, room.phaseEndsAt);
    } else if (room.phase === 'question') {
      const active = room.players.filter(online);
      if (active.length === 0 || !active.every((p) => p.answer)) break;
      endQuestion(room, now);
    } else if (room.phase === 'reveal' && due) {
      if (room.qIndex >= room.questions.length - 1) {
        setPhase(room, 'finished', room.phaseEndsAt);
      } else {
        room.qIndex += 1;
        beginQuestion(room, room.phaseEndsAt);
      }
    } else {
      break;
    }
  }
}

/** What one player is allowed to see right now — never the correct answer before the reveal. */
function snapshot(room: Room, me: Player, seen: Seen, now: number) {
  const inRound = room.phase === 'question' || room.phase === 'reveal';
  const revealed = room.phase === 'reveal';
  const q = inRound ? room.questions[room.qIndex] : null;
  return {
    version: room.version,
    pin: room.pin,
    phase: room.phase,
    you: me.id,
    hostId: room.hostId,
    maxPlayers: MAX_PLAYERS,
    settings: room.settings,
    serverNow: now,
    phaseStartedAt: room.phaseStartedAt,
    phaseEndsAt: room.phaseEndsAt,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      streak: p.streak,
      correctCount: p.correctCount,
      connected: p === me || now - Math.max(seen[p.token] ?? 0, p.joinedAt) < OFFLINE_AFTER_MS,
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
    reveal:
      q && revealed
        ? {
            correctIdx: q.correctIdx,
            counts: q.choices.map((_, i) => room.players.filter((p) => p.answer?.choice === i).length),
            isLast: room.qIndex >= room.questions.length - 1,
          }
        : null,
  };
}

type Action = (room: Room, me: Player, now: number, seen: Seen) => void;

export class Game {
  constructor(private store: Store) {}

  async createRoom(rawName: unknown, rawSettings: unknown): Promise<EnterResult> {
    const name = cleanName(rawName);
    if (!name) return { ok: false, error: 'Pick a name between 1 and 16 characters.' };
    const settings = cleanSettings(rawSettings);
    if (!settings) return { ok: false, error: 'Pick at least one category.' };

    for (let attempt = 0; attempt < 10; attempt++) {
      const now = Date.now();
      const room: Room = {
        version: 1,
        pin: String(randomInt(100000, 1000000)),
        hostId: '',
        players: [],
        settings,
        phase: 'lobby',
        questions: [],
        qIndex: 0,
        phaseStartedAt: now,
        phaseEndsAt: now,
      };
      const me = newPlayer(room, name, now);
      room.players.push(me);
      room.hostId = me.id;
      if (await this.store.create(room.pin, JSON.stringify(room), me.token, now)) {
        return { ok: true, pin: room.pin, token: me.token, state: snapshot(room, me, {}, now) };
      }
    }
    return { ok: false, error: 'Could not create a game. Please try again.' };
  }

  async joinRoom(rawPin: unknown, rawName: unknown): Promise<EnterResult> {
    const name = cleanName(rawName);
    if (!name) return { ok: false, error: 'Pick a name between 1 and 16 characters.' };
    const pin = String(rawPin ?? '').trim();
    if (!/^\d{6}$/.test(pin)) return { ok: false, error: 'No game found with that PIN.' };

    // Retried when another request changes the room first, so two people can't take the last seat.
    for (let attempt = 0; attempt < 8; attempt++) {
      const { raw, seen } = await this.store.load(pin);
      if (!raw) return { ok: false, error: 'No game found with that PIN.' };
      const room: Room = JSON.parse(raw);
      const now = Date.now();
      advance(room, seen, now);
      if (room.phase !== 'lobby') return { ok: false, error: 'That game has already started.' };
      if (room.players.length >= MAX_PLAYERS) {
        return { ok: false, error: `That game is full (${MAX_PLAYERS} players max).` };
      }
      if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        return { ok: false, error: 'Someone in that game already has this name.' };
      }
      const me = newPlayer(room, name, now);
      room.players.push(me);
      room.version += 1;
      if (await this.store.replace(pin, raw, JSON.stringify(room))) {
        return { ok: true, pin, token: me.token, state: snapshot(room, me, seen, now) };
      }
    }
    return { ok: false, error: 'The game is busy. Please try again.' };
  }

  /** The poll every client makes about once a second. Returns null if the player isn't in the room. */
  state(pin: string, token: string) {
    return this.update(pin, token, () => {});
  }

  updateSettings(pin: string, token: string, rawSettings: unknown) {
    return this.update(pin, token, (room, me) => {
      const settings = cleanSettings(rawSettings);
      if (settings && room.phase === 'lobby' && room.hostId === me.id) room.settings = settings;
    });
  }

  start(pin: string, token: string) {
    return this.update(pin, token, (room, me, now) => {
      if (room.phase !== 'lobby' || room.hostId !== me.id) return;
      room.questions = dealQuestions(room.settings);
      room.qIndex = 0;
      resetScores(room);
      setPhase(room, 'starting', now, STARTING_MS);
    });
  }

  answer(pin: string, token: string, rawChoice: unknown, rawQuestionIndex: unknown) {
    return this.update(pin, token, (room, me, now) => {
      // The question index guards against a late answer landing on the next question.
      if (room.phase !== 'question' || rawQuestionIndex !== room.qIndex || me.answer) return;
      const question = room.questions[room.qIndex];
      const choice = Number(rawChoice);
      if (!Number.isInteger(choice) || choice < 0 || choice >= question.choices.length) return;

      const duration = room.phaseEndsAt - room.phaseStartedAt;
      const elapsed = Math.min(Math.max(now - room.phaseStartedAt, 0), duration);
      const correct = choice === question.correctIdx;
      // Correct answers earn 500–1000 depending on speed, plus up to 500 for a streak.
      const speedPoints = Math.round(1000 * (1 - elapsed / duration / 2));
      const streakBonus = Math.min(me.streak, 5) * 100;
      me.answer = { choice, correct, points: correct ? speedPoints + streakBonus : 0 };
    });
  }

  playAgain(pin: string, token: string) {
    return this.update(pin, token, (room, me, now, seen) => {
      if (room.phase !== 'finished' || room.hostId !== me.id) return;
      room.players = room.players.filter(
        (p) => p === me || now - Math.max(seen[p.token] ?? 0, p.joinedAt) < OFFLINE_AFTER_MS,
      );
      resetScores(room);
      setPhase(room, 'lobby', now);
    });
  }

  async leave(pin: string, token: string) {
    await this.update(pin, token, (room, me) => {
      room.players = room.players.filter((p) => p !== me);
    });
  }

  /**
   * Load → bring up to date → apply the action → write back. If another request changed
   * the room in between, the write is refused and the whole thing is retried on fresh data.
   */
  private async update(pin: string, token: string, action: Action): Promise<Snapshot | null> {
    if (!/^\d{6}$/.test(pin) || !token) return null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const now = Date.now();
      const { raw, seen } = await this.store.load(pin, token, now);
      if (!raw) return null;
      const room: Room = JSON.parse(raw);
      const me = room.players.find((p) => p.token === token);
      if (!me) return null;

      advance(room, seen, now);
      action(room, me, now, seen);
      if (room.players.length === 0) {
        await this.store.remove(pin);
        return null;
      }
      // An action can make more changes due (e.g. the last answer ends the question).
      advance(room, seen, now);

      if (JSON.stringify(room) === raw) return snapshot(room, me, seen, now);
      room.version += 1;
      if (await this.store.replace(pin, raw, JSON.stringify(room))) {
        return room.players.includes(me) ? snapshot(room, me, seen, now) : null;
      }
    }
    throw new Error('Room is too busy');
  }
}
