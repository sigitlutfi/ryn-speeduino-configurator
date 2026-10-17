import React, { useEffect, useRef, useState } from 'react'

export default function CurveNumberInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)
  const cancelled = useRef(false)
  useEffect(() => { if (!focused) setDraft(String(value)) }, [value, focused])
  return <input {...props} type="number" value={draft}
    onFocus={() => { cancelled.current = false; setFocused(true) }}
    onChange={event => setDraft(event.target.value)}
    onBlur={() => {
      if (!cancelled.current && draft.trim() !== '' && Number.isFinite(Number(draft))) onCommit(Number(draft))
      setDraft(String(value))
      setFocused(false)
    }}
    onKeyDown={event => {
      if (event.key === 'Escape') { cancelled.current = true; event.currentTarget.blur() }
      if (event.key === 'Enter') event.currentTarget.blur()
    }} />
}
