/**
 * Where game rooms live. The API itself keeps no state between requests, so it can run
 * as serverless functions: every request loads the room, changes it, and writes it back.
 *
 * A room is one JSON string. Writes are compare-and-swap (they only succeed if the room
 * is still exactly what the writer read), so two requests can't overwrite each other.
 * "seen" records when each player last polled, kept apart from the room so that polling
 * never conflicts with real changes.
 */
export interface Store {
  /** Reads a room; when `seenKey` is given, also records that this player was just seen. */
  load(pin: string, seenKey?: string, now?: number): Promise<{ raw: string | null; seen: Record<string, number> }>;
  /** Creates a room. Returns false if the PIN is already taken. */
  create(pin: string, raw: string, seenKey: string, now: number): Promise<boolean>;
  /** Replaces a room only if it still equals `oldRaw`. Returns false if someone else changed it. */
  replace(pin: string, oldRaw: string, newRaw: string): Promise<boolean>;
  remove(pin: string): Promise<void>;
}

/** Rooms nobody touches are dropped after this long. */
const ROOM_TTL_SECONDS = 2 * 60 * 60;

/** Local development: rooms live in this process and vanish on restart. */
export class MemoryStore implements Store {
  private rooms = new Map<string, { raw: string; expires: number }>();
  private seen = new Map<string, Record<string, number>>();

  async load(pin: string, seenKey?: string, now = Date.now()) {
    const room = this.rooms.get(pin);
    if (room && room.expires < Date.now()) {
      await this.remove(pin);
      return { raw: null, seen: {} };
    }
    const seen = this.seen.get(pin) ?? {};
    if (seenKey && room) seen[seenKey] = now;
    this.seen.set(pin, seen);
    return { raw: room?.raw ?? null, seen: { ...seen } };
  }

  async create(pin: string, raw: string, seenKey: string, now: number) {
    if ((await this.load(pin)).raw !== null) return false;
    this.rooms.set(pin, { raw, expires: Date.now() + ROOM_TTL_SECONDS * 1000 });
    this.seen.set(pin, { [seenKey]: now });
    return true;
  }

  async replace(pin: string, oldRaw: string, newRaw: string) {
    if (this.rooms.get(pin)?.raw !== oldRaw) return false;
    this.rooms.set(pin, { raw: newRaw, expires: Date.now() + ROOM_TTL_SECONDS * 1000 });
    return true;
  }

  async remove(pin: string) {
    this.rooms.delete(pin);
    this.seen.delete(pin);
  }
}

const REPLACE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  redis.call('EXPIRE', KEYS[2], ARGV[3])
  return 1
end
return 0`;

type Command = (string | number)[];

/** Production: Upstash Redis over its REST API (works from serverless functions). */
export class UpstashStore implements Store {
  private url: string;

  constructor(url: string, private token: string) {
    this.url = url.replace(/\/$/, '');
  }

  private async pipeline(commands: Command[]): Promise<unknown[]> {
    const res = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Redis request failed (${res.status})`);
    const replies = (await res.json()) as { result?: unknown; error?: string }[];
    return replies.map((r) => {
      if (r.error) throw new Error(`Redis error: ${r.error}`);
      return r.result;
    });
  }

  private keys(pin: string) {
    return { room: `quiz:room:${pin}`, seen: `quiz:seen:${pin}` };
  }

  async load(pin: string, seenKey?: string, now = Date.now()) {
    const k = this.keys(pin);
    const commands: Command[] = [['GET', k.room]];
    if (seenKey) commands.push(['HSET', k.seen, seenKey, now]);
    commands.push(['HGETALL', k.seen]);
    const replies = await this.pipeline(commands);

    const raw = (replies[0] as string | null) ?? null;
    const flat = (replies[replies.length - 1] as string[] | null) ?? [];
    const seen: Record<string, number> = {};
    for (let i = 0; i + 1 < flat.length; i += 2) seen[flat[i]] = Number(flat[i + 1]);
    return { raw, seen };
  }

  async create(pin: string, raw: string, seenKey: string, now: number) {
    const k = this.keys(pin);
    const [created] = await this.pipeline([['SET', k.room, raw, 'NX', 'EX', ROOM_TTL_SECONDS]]);
    if (created !== 'OK') return false;
    await this.pipeline([
      ['DEL', k.seen],
      ['HSET', k.seen, seenKey, now],
      ['EXPIRE', k.seen, ROOM_TTL_SECONDS],
    ]);
    return true;
  }

  async replace(pin: string, oldRaw: string, newRaw: string) {
    const k = this.keys(pin);
    const [swapped] = await this.pipeline([
      ['EVAL', REPLACE_SCRIPT, 2, k.room, k.seen, oldRaw, newRaw, ROOM_TTL_SECONDS],
    ]);
    return swapped === 1;
  }

  async remove(pin: string) {
    const k = this.keys(pin);
    await this.pipeline([['DEL', k.room, k.seen]]);
  }
}

export class StoreNotConfiguredError extends Error {}

/** Used on Vercel when no Redis is attached: fail loudly instead of losing games silently. */
class MissingStore implements Store {
  private fail(): never {
    throw new StoreNotConfiguredError(
      'Game storage is not set up: add an Upstash Redis database to this Vercel project.',
    );
  }
  load = async () => this.fail();
  create = async () => this.fail();
  replace = async () => this.fail();
  remove = async () => this.fail();
}

export function createStore(env: NodeJS.ProcessEnv = process.env): Store {
  // The Vercel Marketplace integration injects one pair or the other, depending on its age.
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashStore(url, token);
  if (env.VERCEL) return new MissingStore();
  return new MemoryStore();
}
