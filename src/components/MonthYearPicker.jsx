import { useState, useRef, useEffect } from 'react'
import './MonthYearPicker.css'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * A single button that opens a small calendar-style popover — a year
 * stepper up top and a 4x3 grid of months below — instead of two plain
 * <select> dropdowns.
 */
export default function MonthYearPicker({ month, year, onChange }) {
  const [open, setOpen] = useState(false)
  const [draftYear, setDraftYear] = useState(year)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => { setDraftYear(year) }, [year])

  function selectMonth(m) {
    onChange(m, draftYear)
    setOpen(false)
  }

  return (
    <div className="myp-wrap" ref={wrapRef}>
      <button type="button" className="myp-trigger" onClick={() => setOpen(o => !o)}>
        <i className="fas fa-calendar-alt"></i>
        <span>{MONTH_FULL[month]} {year}</span>
        <i className={`fas fa-chevron-down myp-chevron ${open ? 'up' : ''}`}></i>
      </button>

      {open && (
        <div className="myp-popover">
          <div className="myp-year-row">
            <button type="button" className="myp-arrow" onClick={() => setDraftYear(y => y - 1)}>
              <i className="fas fa-chevron-left"></i>
            </button>
            <span className="myp-year-label">{draftYear}</span>
            <button type="button" className="myp-arrow" onClick={() => setDraftYear(y => y + 1)}>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
          <div className="myp-month-grid">
            {MONTH_SHORT.map((m, i) => {
              const isSelected = i === month && draftYear === year
              const isCurrent = i === new Date().getMonth() && draftYear === new Date().getFullYear()
              return (
                <button
                  type="button"
                  key={m}
                  className={`myp-month-btn ${isSelected ? 'selected' : ''} ${isCurrent && !isSelected ? 'current' : ''}`}
                  onClick={() => selectMonth(i)}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
