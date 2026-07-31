'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={theme === 'day' ? 'Switch to Evening mode' : 'Switch to Day mode'}
      className="size-8 hover:bg-white/10"
      style={{ color: 'var(--header-text)', opacity: 0.75 }}
    >
      {theme === 'day' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  )
}
