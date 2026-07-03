'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState('day')

  useEffect(() => {
    const saved = localStorage.getItem('wf-theme') || 'day'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  function toggle() {
    const next = theme === 'day' ? 'evening' : 'day'
    setTheme(next)
    localStorage.setItem('wf-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'day' ? 'Switch to Evening mode' : 'Switch to Day mode'}
      style={{
        background: 'none',
        border: '1px solid var(--line)',
        borderRadius: 20,
        padding: '4px 10px',
        cursor: 'pointer',
        fontSize: 13,
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        transition: 'border-color 0.2s',
      }}
    >
      {theme === 'day' ? '🌙' : '☀️'}
    </button>
  )
}
