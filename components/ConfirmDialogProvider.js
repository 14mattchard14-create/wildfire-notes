'use client'

// Drop-in replacement for window.confirm()/window.alert(). Native browser
// dialogs block the whole tab's render + input thread while open — bad UX
// (unstyled, unbranded) and it also breaks automated browser testing (Chrome
// DevTools Protocol commands hang while a native dialog is open, with no way
// to dismiss them programmatically). This renders an in-page modal instead,
// with the same call-site shape as the native functions but Promise-based
// since React can't block synchronously like window.confirm() does.
//
// Usage: const { confirmDialog, alertDialog } = useConfirmDialog()
//   if (await confirmDialog('Delete this?')) { ... }
//   await alertDialog('Saved failed: ' + err.message)

import { createContext, useContext, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'

const ConfirmDialogContext = createContext(null)

export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null) // { message, mode: 'confirm' | 'alert', resolve }

  const confirmDialog = useCallback((message) => {
    return new Promise(resolve => setDialog({ message, mode: 'confirm', resolve }))
  }, [])

  const alertDialog = useCallback((message) => {
    return new Promise(resolve => setDialog({ message, mode: 'alert', resolve }))
  }, [])

  function resolve(value) {
    dialog?.resolve(value)
    setDialog(null)
  }

  return (
    <ConfirmDialogContext.Provider value={{ confirmDialog, alertDialog }}>
      {children}
      {dialog && (
        <div
          onClick={() => resolve(dialog.mode === 'confirm' ? false : undefined)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            role={dialog.mode === 'confirm' ? 'alertdialog' : 'alert'}
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, width: '100%', maxWidth: 420, padding: '22px 22px 18px', boxShadow: '0 8px 48px rgba(0,0,0,0.5)' }}
          >
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: '0 0 20px' }}>{dialog.message}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {dialog.mode === 'confirm' && (
                <Button variant="outline" onClick={() => resolve(false)}>Cancel</Button>
              )}
              <Button onClick={() => resolve(dialog.mode === 'confirm' ? true : undefined)} autoFocus>OK</Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider')
  return ctx
}
