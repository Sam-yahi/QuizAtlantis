import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useGame } from './useGame'
import type { Game } from './useGame'
import type { Category, Config, GameState, PlayerView, Settings } from './types'

const APP_NAME = 'QuizAtlantis'
const LETTERS = ['A', 'B', 'C', 'D']

/** Re-renders on an interval and returns the current server time. */
function useServerNow(clockOffset: number, intervalMs = 100) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now + clockOffset
}

function ranked(players: PlayerView[]) {
  return [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

export default function App() {
  const game = useGame()
  const { state, config, connected } = game

  let screen
  if (!config) screen = <p className="status">{connected ? 'Loading…' : 'Connecting to the game server…'}</p>
  else if (!state) screen = <Home game={game} config={config} />
  else if (state.phase === 'lobby') screen = <Lobby game={game} state={state} config={config} />
  else if (state.phase === 'starting') screen = <Starting game={game} state={state} />
  else if (state.phase === 'finished') screen = <Finished game={game} state={state} />
  else screen = <Round game={game} state={state} config={config} />

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">🔱 {APP_NAME}</span>
        {state && (
          <button className="btn ghost small" onClick={game.leave}>
            Leave game
          </button>
        )}
      </header>
      {!connected && config && <div className="banner">Connection lost — reconnecting…</div>}
      <main>{screen}</main>
    </div>
  )
}

// ---------- Home: create or join ----------

function Home({ game, config }: { game: Game; config: Config }) {
  const linkPin = new URLSearchParams(location.search).get('pin') ?? ''
  const [mode, setMode] = useState<'join' | 'create'>(linkPin ? 'join' : 'create')
  const [name, setName] = useState('')
  const [pin, setPin] = useState(linkPin.replace(/\D/g, '').slice(0, 6))
  const [settings, setSettings] = useState<Settings>({
    categories: config.categories.map((c) => c.id),
    questionCount: 10,
    timeLimit: 20,
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ready =
    name.trim().length > 0 && (mode === 'create' ? settings.categories.length > 0 : pin.length === 6)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(mode === 'create' ? await game.create(name, settings) : await game.join(pin, name))
    setBusy(false)
  }

  return (
    <form className="card home" onSubmit={submit}>
      <h1>Dive in and outsmart your friends</h1>
      <p className="muted">
        Live quiz battles for up to {config.maxPlayers} players. Fast answers score more.
      </p>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'create'} onClick={() => setMode('create')}>
          Create a game
        </button>
        <button type="button" role="tab" aria-selected={mode === 'join'} onClick={() => setMode('join')}>
          Join with a PIN
        </button>
      </div>

      <label className="field">
        <span>Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          placeholder="e.g. Captain Nemo"
          autoFocus
        />
      </label>

      {mode === 'join' ? (
        <label className="field">
          <span>Game PIN</span>
          <input
            className="pin-input"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="000000"
          />
        </label>
      ) : (
        <SettingsEditor config={config} settings={settings} onChange={setSettings} />
      )}

      {error && <p className="error">{error}</p>}
      <button className="btn primary" disabled={!ready || busy}>
        {mode === 'create' ? 'Create game' : 'Join game'}
      </button>
    </form>
  )
}

function SettingsEditor({
  config,
  settings,
  onChange,
  readOnly = false,
}: {
  config: Config
  settings: Settings
  onChange?: (s: Settings) => void
  readOnly?: boolean
}) {
  const toggle = (id: string) => {
    const has = settings.categories.includes(id)
    const categories = has ? settings.categories.filter((c) => c !== id) : [...settings.categories, id]
    onChange?.({ ...settings, categories })
  }
  return (
    <div className="settings">
      <div className="field">
        <span>Categories</span>
        <div className="chips">
          {config.categories.map((c) => (
            <button
              type="button"
              key={c.id}
              className="chip"
              style={{ '--chip': c.color } as React.CSSProperties}
              aria-pressed={settings.categories.includes(c.id)}
              disabled={readOnly}
              onClick={() => toggle(c.id)}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-row">
        <Segmented
          label="Questions"
          options={config.questionCounts}
          value={settings.questionCount}
          readOnly={readOnly}
          onChange={(questionCount) => onChange?.({ ...settings, questionCount })}
        />
        <Segmented
          label="Seconds per question"
          options={config.timeLimits}
          value={settings.timeLimit}
          readOnly={readOnly}
          onChange={(timeLimit) => onChange?.({ ...settings, timeLimit })}
        />
      </div>
    </div>
  )
}

function Segmented(props: {
  label: string
  options: number[]
  value: number
  readOnly: boolean
  onChange: (v: number) => void
}) {
  return (
    <div className="field">
      <span>{props.label}</span>
      <div className="segmented">
        {props.options.map((o) => (
          <button
            type="button"
            key={o}
            aria-pressed={o === props.value}
            disabled={props.readOnly}
            onClick={() => props.onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- Lobby ----------

function Lobby({ game, state, config }: { game: Game; state: GameState; config: Config }) {
  const [copied, setCopied] = useState(false)
  const isHost = state.you === state.hostId
  const host = state.players.find((p) => p.id === state.hostId)
  const emptySlots = Math.max(state.maxPlayers - state.players.length, 0)
  const canStart = state.settings.categories.length > 0

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?pin=${state.pin}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (e.g. plain http on a phone): the PIN is on screen anyway.
    }
  }

  return (
    <div className="lobby">
      <section className="card pin-card">
        <span className="muted">Game PIN</span>
        <strong className="pin">{state.pin}</strong>
        <button className="btn ghost small" onClick={copyLink}>
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
      </section>

      <section className="card">
        <h2>
          Players{' '}
          <span className="muted">
            {state.players.length}/{state.maxPlayers}
          </span>
        </h2>
        <ul className="slots">
          {state.players.map((p) => (
            <li key={p.id} className={p.id === state.you ? 'slot you' : 'slot'}>
              <span className="avatar">{p.avatar}</span>
              <span className="slot-name">{p.name}</span>
              {p.id === state.hostId && <span className="tag">Host</span>}
            </li>
          ))}
          {Array.from({ length: emptySlots }, (_, i) => (
            <li key={i} className="slot empty">
              Waiting…
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Game settings</h2>
        <SettingsEditor
          config={config}
          settings={state.settings}
          readOnly={!isHost}
          onChange={game.updateSettings}
        />
        {isHost ? (
          <button className="btn primary" disabled={!canStart} onClick={game.start}>
            {state.players.length === 1 ? 'Start solo' : `Start with ${state.players.length} players`}
          </button>
        ) : (
          <p className="status">Waiting for {host?.name ?? 'the host'} to start…</p>
        )}
      </section>
    </div>
  )
}

// ---------- Countdown before the first question ----------

function Starting({ game, state }: { game: Game; state: GameState }) {
  const now = useServerNow(game.clockOffset)
  const seconds = Math.max(Math.ceil((state.phaseEndsAt - now) / 1000), 1)
  return (
    <div className="starting">
      <p className="muted">Get ready</p>
      <div className="big-count" key={seconds}>
        {seconds}
      </div>
    </div>
  )
}

// ---------- Question + reveal ----------

function Round({ game, state, config }: { game: Game; state: GameState; config: Config }) {
  const now = useServerNow(game.clockOffset)
  const q = state.question!
  const { reveal, myAnswer } = state
  const category: Category | undefined = config.categories.find((c) => c.id === q.category)
  const me = state.players.find((p) => p.id === state.you)
  const active = state.players.filter((p) => p.connected)
  const answeredCount = active.filter((p) => p.answered).length

  const total = state.phaseEndsAt - state.phaseStartedAt
  const remaining = Math.max(state.phaseEndsAt - now, 0)
  const canAnswer = state.phase === 'question' && myAnswer === null

  const { answer } = game
  useEffect(() => {
    if (!canAnswer) return
    const onKey = (e: KeyboardEvent) => {
      const idx = ['1', '2', '3', '4'].indexOf(e.key)
      const letterIdx = LETTERS.indexOf(e.key.toUpperCase())
      const choice = idx >= 0 ? idx : letterIdx
      if (choice >= 0 && choice < q.choices.length) answer(choice, q.index)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canAnswer, q.choices.length, q.index, answer])

  let feedback
  if (reveal) {
    if (me?.lastCorrect) feedback = <p className="feedback good">Correct! +{me.lastPoints} points</p>
    else if (myAnswer === null) feedback = <p className="feedback bad">Time's up!</p>
    else feedback = <p className="feedback bad">Not this time</p>
  } else if (myAnswer !== null) {
    feedback = (
      <p className="feedback">
        Locked in — {answeredCount}/{active.length} answered
      </p>
    )
  }

  return (
    <div className="round">
      <div className="round-head">
        <span className="tag" style={{ '--chip': category?.color } as React.CSSProperties}>
          {category?.icon} {category?.name}
        </span>
        <span className="muted">
          Question {q.index + 1} of {q.total}
        </span>
        <span className="clock">
          {reveal ? `Next in ${Math.ceil(remaining / 1000)}` : Math.ceil(remaining / 1000)}
        </span>
      </div>
      <div className="timebar">
        <div
          className={reveal ? 'timebar-fill calm' : 'timebar-fill'}
          style={{ width: `${total > 0 ? (remaining / total) * 100 : 0}%` }}
        />
      </div>

      <h1 className="question">{q.text}</h1>

      <div className="answers">
        {q.choices.map((choice, i) => {
          const classes = ['answer', `answer-${i}`]
          if (myAnswer === i) classes.push('picked')
          if (reveal) classes.push(i === reveal.correctIdx ? 'correct' : 'wrong')
          else if (myAnswer !== null && myAnswer !== i) classes.push('dimmed')
          return (
            <button key={i} className={classes.join(' ')} disabled={!canAnswer} onClick={() => answer(i, q.index)}>
              <span className="letter">{LETTERS[i]}</span>
              <span className="answer-text">{choice}</span>
              {reveal && (
                <span className="count">
                  {i === reveal.correctIdx ? '✓ ' : ''}
                  {reveal.counts[i]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="feedback-slot">{feedback}</div>

      {reveal ? (
        <section className="card">
          <h2>{reveal.isLast ? 'Final scores coming up…' : 'Leaderboard'}</h2>
          <Leaderboard players={state.players} you={state.you} showDelta />
        </section>
      ) : (
        <ul className="answered-row">
          {state.players.map((p) => (
            <li
              key={p.id}
              className={[p.answered ? 'done' : '', p.connected ? '' : 'offline'].join(' ')}
              title={p.name}
            >
              {p.avatar}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Leaderboard({
  players,
  you,
  showDelta = false,
}: {
  players: PlayerView[]
  you: string
  showDelta?: boolean
}) {
  return (
    <ol className="leaderboard">
      {ranked(players).map((p, i) => (
        <li key={p.id} className={[p.id === you ? 'you' : '', p.connected ? '' : 'offline'].join(' ')}>
          <span className="rank">{i + 1}</span>
          <span className="avatar">{p.avatar}</span>
          <span className="slot-name">
            {p.name}
            {p.streak >= 2 && <span className="streak"> 🔥{p.streak}</span>}
          </span>
          {showDelta && !!p.lastPoints && <span className="delta">+{p.lastPoints}</span>}
          <span className="score">{p.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  )
}

// ---------- Final results ----------

function Finished({ game, state }: { game: Game; state: GameState }) {
  const order = ranked(state.players)
  const isHost = state.you === state.hostId
  const myRank = order.findIndex((p) => p.id === state.you) + 1
  const total = state.settings.questionCount
  const medals = ['🥇', '🥈', '🥉']
  // Visual order: 2nd, 1st, 3rd.
  const podium = [order[1], order[0], order[2]]

  return (
    <div className="finished">
      <h1>{myRank === 1 ? 'You won! 🎉' : `You finished #${myRank}`}</h1>

      <div className="podium">
        {podium.map((p, col) => {
          if (!p) return <div key={col} className="podium-col" />
          const place = order.indexOf(p)
          return (
            <div key={p.id} className={`podium-col place-${place + 1}`}>
              <span className="avatar big">{p.avatar}</span>
              <strong>{p.name}</strong>
              <span className="muted">{p.score.toLocaleString()} pts</span>
              <div className="podium-block">{medals[place]}</div>
            </div>
          )
        })}
      </div>

      <section className="card">
        <h2>Final ranking</h2>
        <ol className="leaderboard">
          {order.map((p, i) => (
            <li key={p.id} className={p.id === state.you ? 'you' : ''}>
              <span className="rank">{i + 1}</span>
              <span className="avatar">{p.avatar}</span>
              <span className="slot-name">{p.name}</span>
              <span className="muted">
                {p.correctCount}/{total} correct
              </span>
              <span className="score">{p.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
        {isHost ? (
          <button className="btn primary" onClick={game.playAgain}>
            Play again
          </button>
        ) : (
          <p className="status">The host can start another round.</p>
        )}
      </section>
    </div>
  )
}
