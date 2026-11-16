import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Game, MAX_PLAYERS, QUESTION_COUNTS, TIME_LIMITS } from './game';
import type { Snapshot } from './game';
import { CATEGORIES, QUESTION_BANK } from './questions';
import { createStore, StoreNotConfiguredError } from './store';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const game = new Game(createStore());

// Every route lives under /api: in production that prefix is what routes a request here.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/config', (_req, res) =>
  res.json({
    maxPlayers: MAX_PLAYERS,
    questionCounts: QUESTION_COUNTS,
    timeLimits: TIME_LIMITS,
    categories: CATEGORIES.map((c) => ({
      ...c,
      questionCount: QUESTION_BANK.filter((q) => q.category === c.id).length,
    })),
  }),
);

app.post('/api/rooms', async (req, res) => {
  res.json(await game.createRoom(req.body?.name, req.body?.settings));
});

app.post('/api/rooms/:pin/join', async (req, res) => {
  res.json(await game.joinRoom(req.params.pin, req.body?.name));
});

/** Routes for a player already in a room, identified by the token they got on entering. */
function playerRoute(
  method: 'get' | 'post',
  path: string,
  handler: (pin: string, token: string, body: Record<string, unknown>) => Promise<Snapshot | null | void>,
) {
  app[method](`/api/rooms/:pin/${path}`, async (req: Request, res: Response) => {
    const token = req.get('x-player-token') ?? '';
    const state = await handler(String(req.params.pin), token, req.body ?? {});
    res.set('Cache-Control', 'no-store');
    if (state) res.json(state);
    else res.status(404).json({ error: 'That game is no longer available.' });
  });
}

playerRoute('get', 'state', (pin, token) => game.state(pin, token));
playerRoute('post', 'settings', (pin, token, body) => game.updateSettings(pin, token, body));
playerRoute('post', 'start', (pin, token) => game.start(pin, token));
playerRoute('post', 'answer', (pin, token, body) => game.answer(pin, token, body.choice, body.questionIndex));
playerRoute('post', 'play-again', (pin, token) => game.playAgain(pin, token));
playerRoute('post', 'leave', (pin, token) => game.leave(pin, token));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const notConfigured = err instanceof StoreNotConfiguredError;
  if (!notConfigured) console.error(err);
  res.status(notConfigured ? 503 : 500).json({
    ok: false,
    error: notConfigured ? (err as Error).message : 'Something went wrong on the game server.',
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
