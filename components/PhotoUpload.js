'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Resize + compress a File to a JPEG data URL under targetBytes
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
        while (url.length > targetBytes && q > 0.2) {
          q -= 0.1
          url = canvas.toDataURL('image/jpeg', q)
        }
        resolve(url)
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Upload a base64 data URL to Supabase Storage, return the public URL
async function uploadToSupabase(dataUrl, propertyId) {
  const blob = await (await fetch(dataUrl)).blob()
  const filename = `${propertyId}/${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from('entry-photos')
    .upload(filename, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('entry-photos').getPublicUrl(filename)
  return data.publicUrl
}

export default function PhotoUpload({ propertyId, onPhotoUrl }) {
  const [preview,   setPreview]   = useState(null)   // local data URL for preview
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

  function remove() {
    setPreview(null)
    onPhotoUrl(null)
  }

  if (preview) {
    return (
      <div>
        <img src={preview} alt="Entry photo" className="rounded border border-stone-700 max-h-48 w-auto" />
        <button onClick={remove} className="mt-2 text-red-500 text-xs font-mono uppercase tracking-wide">
          Remove photo
        </button>
      </div>
    )
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => inputRef.current.click()}
        disabled={uploading}
        className="w-full border border-dashed border-stone-700 rounded py-3 text-stone-500 text-xs font-mono uppercase tracking-wide hover:border-orange-600 hover:text-orange-600 transition-colors disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : '+ Take / Upload Photo'}
      </button>
    </>
  )
}
