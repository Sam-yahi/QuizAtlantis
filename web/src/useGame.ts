import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import type { Config, GameState, JoinResult, Settings } from './types'

// Same origin: Vite proxies /socket.io and /api to the API in dev.
const socket = io({ autoConnect: false })
const SESSION_KEY = 'quiz-session'

function loadSession(): { pin: string; token: string } | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}

function saveSession(session: { pin: string; token: string } | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage unavailable: the game still works, just without refresh recovery.
  }
}

export function useGame() {
  const [config, setConfig] = useState<Config | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [connected, setConnected] = useState(false)
  // Server clock minus local clock, so countdowns agree across devices.
  const [clockOffset, setClockOffset] = useState(0)

  useEffect(() => {
    const onConnect = () => {
      setConnected(true)
      // Fetched on every (re)connect, so the page recovers if the API starts after it.
      fetch('/api/config')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setConfig)
        .catch(() => {})
      const session = loadSession()
      if (!session) return
      socket.emit('rejoin', session, (res: JoinResult) => {
        if (!res.ok) {
          saveSession(null)
          setState(null)
        }
      })
    }
    const onDisconnect = () => setConnected(false)
    const onState = (next: GameState) => {
      setClockOffset(next.serverNow - Date.now())
      setState(next)
    }
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('state', onState)
    socket.connect()
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('state', onState)
      socket.disconnect()
    }
  }, [])

  const enter = useCallback(
    (event: 'create' | 'join', payload: object) =>
      new Promise<string | null>((resolve) => {
        socket.timeout(5000).emit(event, payload, (err: Error | null, res: JoinResult) => {
          if (err) return resolve('Could not reach the game server.')
          if (!res.ok) return resolve(res.error)
          saveSession({ pin: res.pin, token: res.token })
          resolve(null)
        })
      }),
    [],
  )

  return {
    config,
    state,
    connected,
    clockOffset,
    /** Both resolve to an error message, or null on success. */
    create: (name: string, settings: Settings) => enter('create', { name, settings }),
    join: (pin: string, name: string) => enter('join', { pin, name }),
    updateSettings: (settings: Settings) => socket.emit('settings', settings),
    start: () => socket.emit('start'),
    answer: (choice: number) => socket.emit('answer', choice),
    playAgain: () => socket.emit('playAgain'),
    leave: () => {
      socket.emit('leave')
      saveSession(null)
      setState(null)
    },
  }
}

export type Game = ReturnType<typeof useGame>
