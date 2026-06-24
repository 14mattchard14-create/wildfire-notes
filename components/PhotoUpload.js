'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const c = {
  surface: '#242220',
  line:    '#3a352f',
  accent:  '#be5b1d',
  text:    '#ece6db',
  muted:   '#9a9285',
  warn:    '#b5483a',
}

function compressImage(file, maxDim = 800, targetBytes = 700_000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim }
        else if (h > maxDim)     { w = Math.round(w * maxDim / h); h = maxDim }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        let q = 0.65
        let url = canvas.toDataURL('image/jpeg', q)
        while (url.length > targetBytes && q > 0.2) { q -= 0.1; url = canvas.toDataURL('image/jpeg', q) }
        resolve(url)
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadToSupabase(dataUrl, propertyId) {
  const blob = await (await fetch(dataUrl)).blob()
  const filename = `${propertyId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('entry-photos').upload(filename, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('entry-photos').getPublicUrl(filename)
  return data.publicUrl
}

export default function PhotoUpload({ propertyId, onPhotoUrl }) {
  const [preview,   setPreview]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      setPreview(compressed)
      const publicUrl = await uploadToSupabase(compressed, propertyId)
      onPhotoUrl(publicUrl)
    } catch (err) {
      alert('Photo upload failed: ' + err.message)
      setPreview(null)
      onPhotoUrl(null)
    }
    setUploading(false)
  }

  function remove() { setPreview(null); onPhotoUrl(null) }

  if (preview) {
    return (
      <div>
        <img src={preview} alt="Entry photo" style={{ borderRadius: 4, border: `1px solid ${c.line}`, maxHeight: 192, width: 'auto' }} />
        <button onClick={remove} style={{ marginTop: 8, fontSize: 11, fontFamily: 'monospace', color: c.warn, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Remove photo
        </button>
      </div>
    )
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <button
        type="button"
        onClick={() => inputRef.current.click()}
        disabled={uploading}
        style={{ width: '100%', background: c.surface, border: `1px dashed ${c.line}`, borderRadius: 4, padding: 14, textAlign: 'center', fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: c.muted, cursor: 'pointer' }}
      >
        {uploading ? 'Uploading…' : '+ Take / Upload Photo'}
      </button>
    </>
  )
}
