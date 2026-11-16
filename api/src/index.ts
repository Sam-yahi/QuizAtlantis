import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameManager, MAX_PLAYERS, QUESTION_COUNTS, TIME_LIMITS } from './game';
import { CATEGORIES, QUESTION_BANK } from './questions';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

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

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
const games = new GameManager((socketId, snapshot) => io.to(socketId).emit('state', snapshot));

io.on('connection', (socket) => {
  const reply = (ack: unknown, result: unknown) => {
    if (typeof ack === 'function') ack(result);
  };

  socket.on('create', (data, ack) => reply(ack, games.createRoom(socket.id, data?.name, data?.settings)));
  socket.on('join', (data, ack) => reply(ack, games.joinRoom(socket.id, data?.pin, data?.name)));
  socket.on('rejoin', (data, ack) => reply(ack, games.rejoin(socket.id, data?.pin, data?.token)));
  socket.on('settings', (data) => games.updateSettings(socket.id, data));
  socket.on('start', () => games.start(socket.id));
  socket.on('answer', (choice) => games.answer(socket.id, choice));
  socket.on('playAgain', () => games.playAgain(socket.id));
  socket.on('leave', () => games.leave(socket.id, true));
  socket.on('disconnect', () => games.leave(socket.id, false));
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`API running on port ${PORT}`));
