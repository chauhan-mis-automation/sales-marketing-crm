import { QUICK_RANGES } from '../lib/useDateRangeFilter'

export default function DateFilterBar({ filter }) {
  const { activePreset, fromDate, toDate, applyPreset, applyManualDates, updateFrom, updateTo } = filter

  return (
    <div className="dash-filter-bar">
      <label>From</label>
      <input type="date" value={fromDate} onChange={e => updateFrom(e.target.value)} />
      <label>To</label>
      <input type="date" value={toDate} onChange={e => updateTo(e.target.value)} />
      <button className="btn-apply" onClick={applyManualDates}>
        <i className="fas fa-search"></i> Apply
      </button>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {QUICK_RANGES.map(r => (
          <button
            key={r.key}
            className={`quick-btn ${activePreset === r.key ? 'active' : ''}`}
            onClick={() => applyPreset(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <button className="btn-clear" onClick={() => applyPreset('all')}>
        <i className="fas fa-times"></i> Clear
      </button>
    </div>
  )
}
