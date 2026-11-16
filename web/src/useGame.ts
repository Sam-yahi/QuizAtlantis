import { useCallback, useEffect, useState } from 'react'
import type { Config, EnterResult, GameState, Settings } from './types'

// Empty by default: the API is served from the same address under /api (Vite proxies it
// in dev). Set VITE_API_URL at build time only if the API is hosted somewhere else.
const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const SESSION_KEY = 'quiz-session'

interface Session {
  pin: string
  token: string
}

function loadSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}

function saveSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage unavailable: the game still works, just without refresh recovery.
  }
}

/** Returns the HTTP status and parsed body, or null when the server can't be reached. */
async function request(method: 'GET' | 'POST', path: string, token?: string, body?: object) {
  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      method,
      cache: 'no-store',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'x-player-token': token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, data: await res.json() }
  } catch {
    return null
  }
}

/**
 * How long to wait before asking the server again. The server has no way to push, so the
 * client polls — and asks right when the current phase is due to end, so everyone moves on
 * to the next question together.
 */
function nextPollDelay(state: GameState) {
  const timed = state.phase === 'starting' || state.phase === 'question' || state.phase === 'reveal'
  const base = state.phase === 'lobby' || state.phase === 'question' ? 1000 : 2000
  if (!timed) return base
  const untilEnd = state.phaseEndsAt - state.serverNow
  return Math.max(Math.min(base, untilEnd + 40), 150)
}

export function useGame() {
  const [config, setConfig] = useState<Config | null>(null)
  const [session, setSession] = useState<Session | null>(loadSession)
  const [state, setState] = useState<GameState | null>(null)
  const [connected, setConnected] = useState(true)
  // Server clock minus local clock, so countdowns agree across devices.
  const [clockOffset, setClockOffset] = useState(0)

  /** Takes a snapshot from the server, ignoring any that arrive out of order. */
  const apply = useCallback((next: GameState, sentAt: number) => {
    setClockOffset(next.serverNow - (sentAt + Date.now()) / 2)
    setState((prev) => {
      const stale =
        prev !== null &&
        prev.pin === next.pin &&
        (next.version < prev.version || (next.version === prev.version && next.serverNow < prev.serverNow))
      if (stale) return prev
      // A poll that was already in flight when the player answered must not undo their pick.
      const sameQuestion =
        prev?.pin === next.pin && prev.phase === 'question' && next.phase === 'question' &&
        prev.question?.index === next.question?.index
      if (sameQuestion && prev.myAnswer !== null && next.myAnswer === null) {
        return { ...next, myAnswer: prev.myAnswer }
      }
      return next
    })
  }, [])

  const endSession = useCallback(() => {
    saveSession(null)
    setSession(null)
    setState(null)
  }, [])

  // Game options. Retried until the API answers, so the page recovers if the API starts late.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false
    const load = async () => {
      const res = await request('GET', '/config')
      if (cancelled) return
      setConnected(res !== null)
      if (res?.status === 200) setConfig(res.data)
      else timer = setTimeout(load, 3000)
    }
    load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  // While in a game, keep asking the server for the latest state.
  useEffect(() => {
    if (!session) return
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false
    const poll = async () => {
      const sentAt = Date.now()
      const res = await request('GET', `/rooms/${session.pin}/state`, session.token)
      if (cancelled) return
      setConnected(res !== null)
      if (res?.status === 404) return endSession()
      let delay = 2000
      if (res?.status === 200) {
        apply(res.data, sentAt)
        delay = nextPollDelay(res.data)
      }
      timer = setTimeout(poll, delay)
    }
    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [session, apply, endSession])

  /** Creates or joins a game. Resolves to an error message, or null on success. */
  const enter = useCallback(
    async (path: string, body: object) => {
      const sentAt = Date.now()
      const res = await request('POST', path, undefined, body)
      if (!res) return 'Could not reach the game server.'
      const result = res.data as EnterResult
      if (!result.ok) return result.error ?? 'Something went wrong. Please try again.'
      const next = { pin: result.pin, token: result.token }
      saveSession(next)
      apply(result.state, sentAt)
      setSession(next)
      return null
    },
    [apply],
  )

  /** Sends a player action and shows the resulting state straight away. */
  const act = useCallback(
    async (path: string, body: object = {}) => {
      if (!session) return false
      const sentAt = Date.now()
      const res = await request('POST', `/rooms/${session.pin}/${path}`, session.token, body)
      if (res?.status === 200) apply(res.data, sentAt)
      return res?.status === 200
    },
    [session, apply],
  )

  const answer = useCallback(
    async (choice: number, questionIndex: number) => {
      // Show the pick instantly; the server's reply confirms it.
      setState((prev) => (prev && prev.myAnswer === null ? { ...prev, myAnswer: choice } : prev))
      const sent = await act('answer', { choice, questionIndex })
      // If it never reached the server, free the buttons so the player can try again.
      if (!sent) setState((prev) => (prev?.question?.index === questionIndex ? { ...prev, myAnswer: null } : prev))
    },
    [act],
  )

  return {
    config,
    state,
    connected,
    clockOffset,
    create: (name: string, settings: Settings) => enter('/rooms', { name, settings }),
    join: (pin: string, name: string) => enter(`/rooms/${pin}/join`, { name }),
    updateSettings: (settings: Settings) => act('settings', settings),
    start: () => act('start'),
    answer,
    playAgain: () => act('play-again'),
    leave: () => {
      act('leave')
      endSession()
    },
  }
}

export type Game = ReturnType<typeof useGame>
