import { useState } from 'react'
import baseData from '../data/notion.json'

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토']
const SAVE_URL = '/.netlify/functions/save-data'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.ceil((target - today) / 86400000)
}

function ddayLabel(n) {
  if (n === null) return null
  if (n < 0) return `D+${Math.abs(n)}`
  if (n === 0) return 'D-DAY'
  return `D-${n}`
}

function ddayColor(n) {
  if (n === null) return '#8e8e93'
  if (n <= 3) return '#dc2626'
  if (n <= 10) return '#ea580c'
  if (n <= 20) return '#d97706'
  return '#059669'
}

function netBudget(p) {
  if (!p.budget) return null
  let net = p.budget
  if (p.deduction) net -= p.deduction.amount
  return net
}

function fmtWon(n) {
  return (n / 10000).toLocaleString() + '만'
}

function riskLevel(p) {
  const d = daysUntil(p.deadline)
  if (d === null) return 'none'
  if (d < 0) return 'overdue'
  if (d <= 14 && p.progress < 50) return 'critical'
  if (d <= 28 && p.progress < 35) return 'warning'
  return 'ok'
}

function Check({ done, onClick }) {
  return (
    <div onClick={onClick} style={{ width: 17, height: 17, borderRadius: 5, border: done ? 'none' : '1.5px solid #cbd5e1', background: done ? '#2563eb' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
      {done && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>✓</span>}
    </div>
  )
}

function TaskRows({ tasks, edit, isDone, onToggle, onEdit, onDelete, onAdd }) {
  const [expanded, setExpanded] = useState(false)
  const list = tasks || []
  const MAX = 3
  const shown = edit || expanded ? list : list.slice(0, MAX)
  const hidden = list.length - MAX
  return (
    <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
      {shown.map((text, i) => {
        const done = isDone(i)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <Check done={done} onClick={() => onToggle(i)} />
            {edit ? (
              <input value={text} onChange={e => onEdit(i, e.target.value)} style={{ flex: 1, fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 6px' }} />
            ) : (
              <span style={{ flex: 1, fontSize: 11, color: done ? '#b8b8bd' : '#555', textDecoration: done ? 'line-through' : 'none' }}>{text}</span>
            )}
            {edit && <button onClick={() => onDelete(i)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 4px' }}>×</button>}
          </div>
        )
      })}
      {edit ? (
        <button onClick={onAdd} style={{ border: '1px dashed #cbd5e1', background: 'none', borderRadius: 5, color: '#6b7280', cursor: 'pointer', fontSize: 11, padding: '3px 8px', marginTop: 4 }}>+ 항목</button>
      ) : (!expanded && hidden > 0 && (
        <button onClick={() => setExpanded(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#8e8e93', padding: '2px 0', marginTop: 2 }}>+ {hidden}개 더 보기</button>
      ))}
    </div>
  )
}

export default function Home() {
  const [data, setData] = useState(baseData)
  const [edit, setEdit] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [doneMap, setDoneMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stroll_done') || '{}') } catch { return {} }
  })

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const today = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 ${DAYS_KR[now.getDay()]}요일`

  const mutate = (fn) => {
    setData(prev => { const next = structuredClone(prev); fn(next); return next })
    setDirty(true); setMsg(null)
  }

  // checkbox "done" state persists to this device instantly (localStorage) —
  // it never needs the git-backed save, unlike text/structure edits above.
  const isChecked = (key, def) => (key in doneMap ? doneMap[key] : !!def)
  const toggleChecked = (key, def) => {
    setDoneMap(prev => {
      const cur = key in prev ? prev[key] : !!def
      const next = { ...prev, [key]: !cur }
      try { localStorage.setItem('stroll_done', JSON.stringify(next)) } catch {}
      return next
    })
  }

  async function save() {
    let secret = localStorage.getItem('stroll_edit_secret')
    if (!secret) {
      secret = window.prompt('편집 비밀번호를 입력하세요')
      if (!secret) return
      localStorage.setItem('stroll_edit_secret', secret)
    }
    setSaving(true); setMsg(null)
    try {
      const res = await fetch(SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, data }),
      })
      if (res.status === 401) {
        localStorage.removeItem('stroll_edit_secret')
        setMsg({ ok: false, text: '비밀번호가 틀렸어요. 다시 시도하세요.' })
      } else if (!res.ok) {
        const t = await res.text()
        setMsg({ ok: false, text: '저장 실패: ' + t.slice(0, 100) })
      } else {
        setDirty(false)
        setMsg({ ok: true, text: '저장됨 · 1~2분 후 모든 기기에 반영돼요' })
      }
    } catch {
      setMsg({ ok: false, text: '네트워크 오류 (함수가 아직 배포 안 됐을 수 있어요)' })
    }
    setSaving(false)
  }

  const active = data.projects.filter(p => p.status === '진행중')
  const critical = active.filter(p => ['critical', 'overdue'].includes(riskLevel(p)))
  const warning = active.filter(p => riskLevel(p) === 'warning')
  const todayItems = data.schedule.filter(s => s.date === todayStr)
  const upcoming = data.schedule
    .map(s => ({ ...s, daysLeft: daysUntil(s.date) }))
    .filter(s => s.daysLeft !== null && s.daysLeft >= 0 && s.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft)
  const totalBudget = active.reduce((sum, p) => sum + (netBudget(p) || 0), 0)
  const nearestD = active
    .map(p => daysUntil(p.deadline))
    .filter(d => d !== null && d >= 0)
    .sort((a, b) => a - b)[0]

  // index into data.projects for a given active project
  const pIndex = (p) => data.projects.findIndex(x => x.id === p.id)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 88px', fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif', fontSize: 14, color: '#1c1c1e', lineHeight: 1.5 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#8e8e93', fontWeight: 600, letterSpacing: '.05em', marginBottom: 2 }}>STROLL HUB</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{today}</div>
          <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 4 }}>노션 동기화: {data.synced_at}</div>
        </div>
        <button onClick={() => setEdit(e => !e)} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1.5px solid ' + (edit ? '#2563eb' : '#e8e8e8'), background: edit ? '#2563eb' : '#fff', color: edit ? '#fff' : '#1c1c1e', cursor: 'pointer' }}>
          {edit ? '✓ 편집 중' : '✏️ 편집'}
        </button>
      </div>

      {/* Pulse */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
        {[
          { label: '진행 중', value: active.length, color: '#1c1c1e' },
          { label: '주의', value: critical.length + warning.length, color: critical.length ? '#dc2626' : warning.length ? '#ea580c' : '#059669' },
          { label: '가장 가까운 마감', value: nearestD !== undefined ? `D-${nearestD}` : '—', color: nearestD !== undefined && nearestD <= 14 ? '#dc2626' : '#1c1c1e' },
          { label: '미수령 합계', value: fmtWon(totalBudget), color: '#1c1c1e' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1.5px solid #e8e8e8', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#8e8e93', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Brain-dump todos */}
      {data.todos && data.todos.items && (
        <div style={{ background: '#fff', border: '1.5px solid #e8e8e8', borderRadius: 10, padding: '12px 16px 8px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', letterSpacing: '.06em' }}>📝 오늘 할 일</div>
            {data.todos.date && <div style={{ fontSize: 10, color: '#c7c7cc' }}>{data.todos.date.slice(5).replace('-', '/')}</div>}
          </div>
          {data.todos.items.map((t, i) => {
            const key = `todo:${data.todos.date}:${i}`
            const done = isChecked(key, t.done)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderTop: i === 0 ? 'none' : '1px solid #f2f2f2' }}>
                <Check done={done} onClick={() => toggleChecked(key, t.done)} />
                {edit ? (
                  <>
                    <input value={t.text} onChange={e => mutate(n => { n.todos.items[i].text = e.target.value })} style={{ flex: 1, fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 5, padding: '4px 7px' }} />
                    <input value={t.tag || ''} placeholder="태그" onChange={e => mutate(n => { n.todos.items[i].tag = e.target.value })} style={{ width: 72, fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 5, padding: '4px 6px' }} />
                    <button onClick={() => mutate(n => { n.todos.items.splice(i, 1) })} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 13, color: done ? '#b8b8bd' : '#1c1c1e', textDecoration: done ? 'line-through' : 'none' }}>{t.text}</span>
                    {t.tag && <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 5 }}>{t.tag}</span>}
                  </>
                )}
              </div>
            )
          })}
          {edit && (
            <button onClick={() => mutate(n => { n.todos.items.push({ text: '', tag: '', done: false }) })} style={{ border: '1px dashed #cbd5e1', background: 'none', borderRadius: 6, color: '#6b7280', cursor: 'pointer', fontSize: 12, padding: '5px 10px', marginTop: 6 }}>+ 할 일 추가</button>
          )}
        </div>
      )}

      {/* Today's schedule */}
      {todayItems.length > 0 && (
        <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', letterSpacing: '.06em', marginBottom: 8 }}>📌 오늘 일정</div>
          {todayItems.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</span>
              {s.time && <span style={{ fontSize: 11, color: '#8e8e93' }}>{s.time}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Risk banners */}
      {critical.length > 0 && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', letterSpacing: '.06em', marginBottom: 8 }}>🔴 즉시 점검 필요</div>
          {critical.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: '1px solid rgba(0,0,0,.05)' }}>
              <div>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</span>
                <span style={{ color: '#8e8e93', fontSize: 11, marginLeft: 8 }}>{ddayLabel(daysUntil(p.deadline))} · 진행 {p.progress}%</span>
              </div>
              <span style={{ background: '#fde8e8', color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>위험</span>
            </div>
          ))}
        </div>
      )}
      {warning.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', letterSpacing: '.06em', marginBottom: 8 }}>🟡 주의 모니터링</div>
          {warning.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: '1px solid rgba(0,0,0,.05)' }}>
              <div>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</span>
                <span style={{ color: '#8e8e93', fontSize: 11, marginLeft: 8 }}>{ddayLabel(daysUntil(p.deadline))} · 진행 {p.progress}%</span>
              </div>
              <span style={{ background: '#fef3c7', color: '#d97706', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>주의</span>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming schedule */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>⏰ D-14 이내 일정</div>
          <div style={{ background: '#fff', border: '1.5px solid #e8e8e8', borderRadius: 10, overflow: 'hidden' }}>
            {upcoming.map((s, i) => {
              const d = s.daysLeft
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: d <= 3 ? '#fee2e2' : d <= 7 ? '#ffedd5' : '#dbeafe', color: d <= 3 ? '#dc2626' : d <= 7 ? '#ea580c' : '#2563eb', flexShrink: 0 }}>{ddayLabel(d)}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{s.title}</span>
                  <span style={{ fontSize: 11, color: '#8e8e93', whiteSpace: 'nowrap' }}>{s.date.slice(5).replace('-', '/')}{s.time ? ' ' + s.time : ''}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Project cards */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>📁 진행 중 프로젝트</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 24 }}>
        {active.map(p => {
          const idx = pIndex(p)
          const d = daysUntil(p.deadline)
          const rl = riskLevel(p)
          const borderColor = rl === 'critical' || rl === 'overdue' ? '#fca5a5' : rl === 'warning' ? '#fde68a' : '#e8e8e8'
          const net = netBudget(p)
          return (
            <div key={p.id} style={{ background: '#fff', border: `1.5px solid ${borderColor}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, flex: 1, lineHeight: 1.35 }}>{p.name}</div>
                {d !== null && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: d <= 7 ? '#fee2e2' : d <= 14 ? '#ffedd5' : '#dbeafe', color: ddayColor(d), flexShrink: 0, marginLeft: 8 }}>{ddayLabel(d)}</span>
                )}
              </div>

              <div style={{ fontSize: 11, color: '#8e8e93', marginBottom: 8 }}>{p.client} · {p.type.join(', ')}</div>

              <div style={{ background: '#f0f0f0', borderRadius: 4, height: 4, marginBottom: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: rl === 'critical' ? '#dc2626' : rl === 'warning' ? '#ea580c' : '#1c1c1e', borderRadius: 4, width: `${p.progress}%`, transition: 'width .3s' }} />
              </div>
              {edit ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#8e8e93' }}>진행</span>
                  <input type="number" min="0" max="100" value={p.progress} onChange={e => mutate(n => { n.projects[idx].progress = Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} style={{ width: 54, fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 5px', textAlign: 'right' }} />
                  <span style={{ fontSize: 10, color: '#8e8e93' }}>%</span>
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#bbb', textAlign: 'right', marginBottom: 4 }}>진행 {p.progress}%</div>
              )}

              <TaskRows
                tasks={p.tasks}
                edit={edit}
                isDone={(i) => isChecked(`task:${p.id}:${i}`, false)}
                onToggle={(i) => toggleChecked(`task:${p.id}:${i}`, false)}
                onEdit={(i, v) => mutate(n => { n.projects[idx].tasks[i] = v })}
                onDelete={(i) => mutate(n => { n.projects[idx].tasks.splice(i, 1) })}
                onAdd={() => mutate(n => { if (!n.projects[idx].tasks) n.projects[idx].tasks = []; n.projects[idx].tasks.push('') })}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f5f5f5', paddingTop: 8, marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {p.artifact && (
                    <a href={p.artifact} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: '#dbeafe', color: '#2563eb', textDecoration: 'none' }}>대시보드 →</a>
                  )}
                  {p.notion_url && (
                    <a href={p.notion_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280', textDecoration: 'none' }}>노션 →</a>
                  )}
                </div>
                {net && (
                  edit ? (
                    <button onClick={() => mutate(n => { n.projects[idx].settled = !n.projects[idx].settled })} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, border: 'none', cursor: 'pointer', background: p.settled ? '#d1fae5' : '#fff7ed', color: p.settled ? '#059669' : '#ea580c' }}>{p.settled ? '정산완료' : '미정산'}</button>
                  ) : (
                    <span style={{ fontSize: 11, color: '#8e8e93' }}>{fmtWon(net)}{p.vat_sep ? ' +VAT' : ''}</span>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Budget summary */}
      <div style={{ background: '#f8f9fa', border: '1.5px solid #e8e8e8', borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#8e8e93', letterSpacing: '.06em', marginBottom: 10 }}>💰 정산 현황</div>
        {active.filter(p => p.budget).map(p => {
          const net = netBudget(p)
          return (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #e8e8e8', fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{p.name}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#8e8e93', fontSize: 11 }}>{fmtWon(net)}{p.vat_sep ? ' +VAT' : ''}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: p.settled ? '#d1fae5' : '#fff7ed', color: p.settled ? '#059669' : '#ea580c' }}>{p.settled ? '정산완료' : '미정산'}</span>
              </div>
            </div>
          )
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 4, borderTop: '2px solid #e8e8e8', fontWeight: 700 }}>
          <span>합계</span>
          <span>{fmtWon(totalBudget)}</span>
        </div>
      </div>

      {/* Save bar */}
      {(dirty || msg) && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,.96)', borderTop: '1px solid #e8e8e8', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, backdropFilter: 'blur(8px)', zIndex: 50 }}>
          <span style={{ fontSize: 12, color: msg ? (msg.ok ? '#059669' : '#dc2626') : '#8e8e93' }}>
            {msg ? msg.text : '저장하지 않은 변경사항이 있어요'}
          </span>
          {dirty && (
            <button onClick={save} disabled={saving} style={{ fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '저장 중…' : '저장'}
            </button>
          )}
        </div>
      )}

    </div>
  )
}
