import { useState, useEffect, useRef } from 'react'

const PIN = import.meta.env.VITE_PIN || '1234'
const SESSION_KEY = 'stroll_auth'
const MAX_ATTEMPTS = 5
const COOLDOWN_MS = 30000

export default function PinLock({ children }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [cooldownUntil, setCooldownUntil] = useState(null)
  const [remaining, setRemaining] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus()
  }, [unlocked])

  useEffect(() => {
    if (!cooldownUntil) return
    const id = setInterval(() => {
      const r = Math.ceil((cooldownUntil - Date.now()) / 1000)
      if (r <= 0) { setCooldownUntil(null); setAttempts(0); setRemaining(0) }
      else setRemaining(r)
    }, 500)
    return () => clearInterval(id)
  }, [cooldownUntil])

  if (unlocked) return children

  function press(digit) {
    if (cooldownUntil) return
    const next = input + digit
    setInput(next)
    if (next.length === PIN.length) {
      if (next === PIN) {
        sessionStorage.setItem(SESSION_KEY, '1')
        setUnlocked(true)
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setInput('')
        if (newAttempts >= MAX_ATTEMPTS) {
          setCooldownUntil(Date.now() + COOLDOWN_MS)
        }
      }
    }
  }

  function del() {
    setInput(p => p.slice(0, -1))
  }

  const inCooldown = !!cooldownUntil

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif' }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>🚶</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1c1c1e', marginBottom: 4 }}>Stroll Hub</div>
        <div style={{ fontSize: 13, color: '#8e8e93', marginBottom: 32 }}>PIN을 입력하세요</div>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 32 }}>
          {Array.from({ length: PIN.length }).map((_, i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < input.length ? '#1c1c1e' : '#d1d1d6', transition: 'background .15s' }} />
          ))}
        </div>

        {/* Keypad */}
        <div className={shake ? 'pin-shake' : ''} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 200, margin: '0 auto 20px' }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
            <button
              key={i}
              onClick={() => k === '⌫' ? del() : k ? press(k) : null}
              disabled={inCooldown || !k}
              style={{ height: 56, borderRadius: 12, border: 'none', background: k ? '#fff' : 'transparent', boxShadow: k ? '0 1px 3px rgba(0,0,0,.12)' : 'none', fontSize: k === '⌫' ? 18 : 20, fontWeight: 500, cursor: k ? 'pointer' : 'default', color: inCooldown ? '#c7c7cc' : '#1c1c1e', transition: 'opacity .15s' }}
            >
              {k}
            </button>
          ))}
        </div>

        {inCooldown && (
          <div style={{ fontSize: 13, color: '#dc2626' }}>{remaining}초 후 재시도</div>
        )}
        {!inCooldown && attempts > 0 && (
          <div style={{ fontSize: 12, color: '#ea580c' }}>잘못된 PIN ({MAX_ATTEMPTS - attempts}회 남음)</div>
        )}
      </div>

      <style>{`
        @keyframes pin-shake {
          0%,100% { transform: translateX(0) }
          20%,60% { transform: translateX(-8px) }
          40%,80% { transform: translateX(8px) }
        }
        .pin-shake { animation: pin-shake .4s ease; }
      `}</style>
    </div>
  )
}
