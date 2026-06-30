'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GUIDED_CHECKLIST, STATUSES } from '@/lib/criteria'
import PhotoUpload from './PhotoUpload'
import InfoModal from './InfoModal'

const c = {
  bg:      '#1b1917',
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
  ok:      '#6b8e63',
  warn:    '#b5483a',
  info:    '#7d8fa6',
}

const input = { width: '100%', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 4, color: c.text, fontSize: 14, padding: '10px 12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }

// Flatten the checklist into a single ordered list of steps, each tagged with its zone
const ALL_STEPS = GUIDED_CHECKLIST.flatMap(group =>
  group.items.map(item => ({ zone: group.zone, instructions: group.instructions, ...item }))
)

const TOP_STATUSES = [
  { value: 'Base Compliant',     label: 'Base ✓' },
  { value: 'Plus Compliant',     label: 'Plus ✓' },
  { value: 'Non-Compliant',      label: 'Non-Comp' },
  { value: 'Needs Verification', label: 'Verify' },
]

function StepForm({ step, propertyId, user, onSaved, onSkip, savedState }) {
  const [status,   setStatus]   = useState(savedState?.status ?? null)
  const [note,     setNote]     = useState(savedState?.note ?? '')
  const [photoUrl, setPhotoUrl] = useState(savedState?.photo_url ?? null)
  const [saving,   setSaving]   = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [photoKey, setPhotoKey] = useState(0)

  async function save() {
    if (!note.trim()) { alert('Add a quick note describing what you see.'); return }
    if (!status)      { alert('Select a status.'); return }
    setSaving(true)
    const userName = user?.user_metadata?.full_name || user?.email || 'Unknown'
    const { error } = await supabase.from('entries').insert({
      property_id: propertyId,
      zone: step.zone,
      category: step.zone,
      status,
      note: note.trim(),
      detail: step.label,
      photo_url: photoUrl || null,
      created_by: user?.id || null,
      created_by_name: userName,
    })
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    onSaved()
  }

  return (
    <div>
      {infoOpen && <InfoModal category={step.zone} onClose={() => setInfoOpen(false)} />}

      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.accent }}>{step.zone}</span>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: c.text, margin: '4px 0 8px' }}>{step.label}</h3>
        <p style={{ fontSize: 13, color: c.muted, lineHeight: 1.5, margin: 0 }}>{step.hint}</p>
        <button onClick={() => setInfoOpen(true)} style={{ marginTop: 8, fontSize: 11, fontFamily: 'monospace', color: c.accent, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          ⓘ Read about this category
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 6 }}>Photo</label>
        <PhotoUpload key={photoKey} propertyId={propertyId} onPhotoUrl={setPhotoUrl} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 6 }}>Status</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
          {TOP_STATUSES.map(s => (
            <button key={s.value} onClick={() => setStatus(s.value)} style={{
              padding: '6px 2px', border: `1px solid ${status === s.value ? c.accent : c.line}`,
              borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace', fontSize: 9.5,
              letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.2,
              color: status === s.value ? c.accent : c.muted,
              background: status === s.value ? 'rgba(190,91,29,.15)' : 'transparent',
            }}>{s.label}</button>
          ))}
          <button onClick={() => setStatus('Not Applicable')} style={{
            padding: '6px 2px', border: `1px solid ${status === 'Not Applicable' ? c.muted : c.line}`,
            borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace', fontSize: 9.5,
            letterSpacing: '0.02em', textTransform: 'uppercase',
            color: status === 'Not Applicable' ? c.text : c.muted, background: 'transparent',
          }}>N/A</button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 9.5, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: c.muted, marginBottom: 6 }}>Quick Note</label>
        <input style={input} type="text" placeholder="What do you see?" value={note} onChange={e => setNote(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving} style={{ flex: 1, background: c.accent, color: '#1b1917', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: 13, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>
        <button onClick={onSkip} style={{ padding: '13px 16px', background: 'transparent', border: `1px solid ${c.line}`, borderRadius: 4, color: c.muted, fontSize: 13, cursor: 'pointer' }}>
          Skip
        </button>
      </div>
    </div>
  )
}

export default function GuidedEntry({ propertyId, user, onClose, onSaved }) {
  const [mode, setMode] = useState(null) // null | 'wizard' | 'checklist'
  const [stepIndex, setStepIndex] = useState(0)
  const [completed, setCompleted] = useState({}) // index -> true

  function markDone(idx) {
    setCompleted(prev => ({ ...prev, [idx]: true }))
  }

  function nextStep() {
    if (stepIndex < ALL_STEPS.length - 1) setStepIndex(i => i + 1)
    else onClose()
  }

  const doneCount = Object.keys(completed).length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: c.bg,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, background: c.bg, borderBottom: `1px solid ${c.line}`, padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5 }}>
        <div>
          <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: c.accent, display: 'block' }}>Guided Entry</span>
          {mode && <span style={{ fontSize: 11, fontFamily: 'monospace', color: c.muted }}>{doneCount} / {ALL_STEPS.length} logged</span>}
        </div>
        <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${c.line}`, background: 'transparent', color: c.muted, fontSize: 14, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, padding: 20, maxWidth: 480, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Mode picker */}
        {!mode && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: c.text, marginBottom: 8 }}>How do you want to work through this?</h2>
            <p style={{ fontSize: 13, color: c.muted, lineHeight: 1.5, marginBottom: 24 }}>
              We'll guide you through every photo and observation needed to build a complete report — {ALL_STEPS.length} items across {GUIDED_CHECKLIST.length} categories.
            </p>

            <button
              onClick={() => setMode('wizard')}
              style={{ width: '100%', textAlign: 'left', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, padding: 16, marginBottom: 12, cursor: 'pointer' }}
            >
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: c.text, marginBottom: 4 }}>Step-by-Step</span>
              <span style={{ display: 'block', fontSize: 12, color: c.muted, lineHeight: 1.4 }}>One item at a time, in order. Best when you're new or want zero guesswork.</span>
            </button>

            <button
              onClick={() => setMode('checklist')}
              style={{ width: '100%', textAlign: 'left', background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, padding: 16, cursor: 'pointer' }}
            >
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: c.text, marginBottom: 4 }}>Full Checklist</span>
              <span style={{ display: 'block', fontSize: 12, color: c.muted, lineHeight: 1.4 }}>See everything at once, tap any item to log it in whatever order you walk the property.</span>
            </button>
          </div>
        )}

        {/* Wizard mode */}
        {mode === 'wizard' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 4, background: c.line, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${((stepIndex + 1) / ALL_STEPS.length) * 100}%`, height: '100%', background: c.accent }} />
              </div>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: c.muted, flexShrink: 0 }}>{stepIndex + 1}/{ALL_STEPS.length}</span>
            </div>

            <StepForm
              step={ALL_STEPS[stepIndex]}
              propertyId={propertyId}
              user={user}
              onSaved={() => { markDone(stepIndex); nextStep() }}
              onSkip={() => nextStep()}
            />

            <button
              onClick={() => setMode(null)}
              style={{ width: '100%', marginTop: 16, fontSize: 11, fontFamily: 'monospace', color: c.muted, background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}
            >
              ← Switch mode
            </button>
          </div>
        )}

        {/* Checklist mode */}
        {mode === 'checklist' && (
          <ChecklistMode
            propertyId={propertyId}
            user={user}
            completed={completed}
            markDone={markDone}
            onBack={() => setMode(null)}
          />
        )}
      </div>
    </div>
  )
}

function ChecklistMode({ propertyId, user, completed, markDone, onBack }) {
  const [activeStepIdx, setActiveStepIdx] = useState(null)

  if (activeStepIdx !== null) {
    return (
      <div>
        <button onClick={() => setActiveStepIdx(null)} style={{ marginBottom: 16, fontSize: 11, fontFamily: 'monospace', color: c.muted, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          ← Back to checklist
        </button>
        <StepForm
          step={ALL_STEPS[activeStepIdx]}
          propertyId={propertyId}
          user={user}
          onSaved={() => { markDone(activeStepIdx); setActiveStepIdx(null) }}
          onSkip={() => setActiveStepIdx(null)}
        />
      </div>
    )
  }

  return (
    <div>
      {GUIDED_CHECKLIST.map(group => (
        <div key={group.zone} style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: c.accent, marginBottom: 4 }}>{group.zone}</h3>
          <p style={{ fontSize: 12, color: c.muted, marginBottom: 10, lineHeight: 1.4 }}>{group.instructions}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {group.items.map(item => {
              const idx = ALL_STEPS.findIndex(s => s.zone === group.zone && s.label === item.label)
              const done = completed[idx]
              return (
                <button
                  key={item.label}
                  onClick={() => setActiveStepIdx(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: c.surface, border: `1px solid ${done ? c.ok : c.line}`,
                    borderRadius: 6, padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `1px solid ${done ? c.ok : c.line}`,
                    background: done ? c.ok : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#1b1917',
                  }}>{done ? '✓' : ''}</span>
                  <span style={{ fontSize: 13, color: done ? c.muted : c.text }}>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button onClick={onBack} style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', color: c.muted, background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>
        ← Switch mode
      </button>
    </div>
  )
}
