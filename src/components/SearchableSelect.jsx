import { useState, useRef, useEffect } from 'react'
import './SearchableSelect.css'

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  disabled = false,
  loading = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  function selectOption(opt) {
    onChange(opt)
    setQuery('')
    setOpen(false)
  }

  function handleFocus() {
    if (disabled) return
    setOpen(true)
    setQuery('')
  }

  const displayText = open ? query : (value || '')

  let emptyMessage = 'No options found'
  if (loading) emptyMessage = 'Loading…'
  else if (options.length === 0) emptyMessage = 'No options available'

  return (
    <div className="ss-wrap" ref={wrapRef}>
      <input
        ref={inputRef}
        className="ss-input"
        value={displayText}
        placeholder={loading ? 'Loading…' : placeholder}
        disabled={disabled}
        onFocus={handleFocus}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
        autoComplete="off"
      />
      {value && !disabled && (
        <button
          type="button"
          className="ss-clear"
          onMouseDown={e => { e.preventDefault(); selectOption('') }}
          aria-label="Clear"
        >
          ×
        </button>
      )}
      {open && !disabled && (
        <div className="ss-dropdown">
          {filtered.length === 0 ? (
            <div className="ss-empty">{emptyMessage}</div>
          ) : (
            filtered.map(opt => (
              <div
                key={opt}
                className={`ss-option ${opt === value ? 'active' : ''}`}
                onMouseDown={e => { e.preventDefault(); selectOption(opt) }}
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}