import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { KPI_METRICS } from '../lib/kpiCalc'
import Modal from './Modal'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// KPI ko sections mein group kiya hai — sirf visual clarity ke liye, form ke
// data/behaviour pe koi asar nahi.
const SECTIONS = [
  { title: '💰 Sales', icon: 'fa-rupee-sign', keys: ['sales_dhu', 'sales_ahu', 'yoy_growth', 'team_sales', 'new_cust_sales_pct', 'overhead_pct'] },
  { title: '📞 Enquiry & Leads', icon: 'fa-inbox', keys: ['enq_new_ind', 'enq_dhu', 'enq_ahu'] },
  { title: '🎯 Follow-ups', icon: 'fa-bullseye', keys: ['fup_phys', 'fup_tele', 'first_phys', 'first_tele'] },
  { title: '📝 Reporting', icon: 'fa-clipboard-list', keys: ['reporting'] },
]

export default function SetTargetModal({ salesTeam, onClose, onSaved }) {
  const now = new Date()

  const [personId, setPersonId] = useState(salesTeam[0]?.user_id || '')
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [mode, setMode] = useState('monthly') // 'monthly' | 'yearly'
  const [values, setValues] = useState({})
  const [maxValues, setMaxValues] = useState({})
  const [maxScoreCarried, setMaxScoreCarried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)

  useEffect(() => {
    if (mode === 'monthly') loadExisting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, month, year, mode])

  async function loadExisting() {
    if (!personId) return
    setLoadingExisting(true)

    const { data: current } = await supabase
      .from('sm_targets')
      .select('*')
      .eq('sales_person_id', personId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    const initial = {}
    KPI_METRICS.forEach(m => { initial[m.targetKey] = current?.[m.targetKey] ?? '' })
    setValues(initial)

    if (current && KPI_METRICS.some(m => current[`${m.targetKey}_max`] !== null && current[`${m.targetKey}_max`] !== undefined)) {
      // Is exact month ke liye Max Score pehle se saved hai — usi ko use karo
      const initialMax = {}
      KPI_METRICS.forEach(m => { initialMax[m.targetKey] = current[`${m.targetKey}_max`] ?? '' })
      setMaxValues(initialMax)
      setMaxScoreCarried(false)
    } else {
      // Is month ke liye Max Score set nahi hai — sabse recent purane month se
      // carry-forward karo. Agar kabhi kisi month ke liye set hi nahi hui, to
      // BLANK rehne do — koi default value force nahi karni (user khud baad
      // mein bharega).
      const { data: recent } = await supabase
        .from('sm_targets')
        .select('*')
        .eq('sales_person_id', personId)
        .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recent && KPI_METRICS.some(m => recent[`${m.targetKey}_max`] !== null && recent[`${m.targetKey}_max`] !== undefined)) {
        const initialMax = {}
        KPI_METRICS.forEach(m => { initialMax[m.targetKey] = recent[`${m.targetKey}_max`] ?? '' })
        setMaxValues(initialMax)
        setMaxScoreCarried(true)
      } else {
        const blank = {}
        KPI_METRICS.forEach(m => { blank[m.targetKey] = '' })
        setMaxValues(blank)
        setMaxScoreCarried(false)
      }
    }

    setLoadingExisting(false)
  }

  function switchMode(newMode) {
    setMode(newMode)
    if (newMode === 'yearly') {
      const blankValues = {}, blankMax = {}
      KPI_METRICS.forEach(m => { blankValues[m.targetKey] = ''; blankMax[m.targetKey] = '' })
      setValues(blankValues)
      setMaxValues(blankMax)
      setMaxScoreCarried(false)
    }
  }

  function updateValue(key, v) {
    setValues(prev => ({ ...prev, [key]: v }))
  }

  function updateMaxValue(key, v) {
    setMaxValues(prev => ({ ...prev, [key]: v }))
    setMaxScoreCarried(false)
  }

  const maxScoreTotal = KPI_METRICS.reduce((sum, m) => sum + (parseFloat(maxValues[m.targetKey]) || 0), 0)

  async function handleSave() {
    if (!personId) { alert('Please select a sales person'); return }
    const person = salesTeam.find(p => p.user_id === personId)

    setSaving(true)
    try {
      if (mode === 'yearly') {
        // Annual target diya gaya hai — currency/count wale KPIs ko 12 se
        // divide karke har month mein equally daal dete hain. Percentage-type
        // KPIs (jaise YoY Growth %, Overhead %) divide nahi hote — wahi rate
        // target sabhi 12 months mein same rehta hai.
        const monthlyPayloads = []
        for (let mo = 0; mo < 12; mo++) {
          const payload = {
            sales_person_id: personId,
            sales_person_name: person?.name || '',
            month: mo,
            year,
            updated_at: new Date().toISOString(),
          }
          KPI_METRICS.forEach(m => {
            const annualVal = parseFloat(values[m.targetKey]) || 0
            payload[m.targetKey] = m.unit === 'pct' ? annualVal : Math.round((annualVal / 12) * 100) / 100
            payload[`${m.targetKey}_max`] = parseFloat(maxValues[m.targetKey]) || 0
          })
          monthlyPayloads.push(payload)
        }
        const { error } = await supabase.from('sm_targets').upsert(monthlyPayloads, { onConflict: 'sales_person_id,month,year' })
        if (error) throw error
        alert(`Annual target set! Har month mein automatically divide ho gaya (${year}, 12 months).`)
      } else {
        const payload = {
          sales_person_id: personId,
          sales_person_name: person?.name || '',
          month,
          year,
          updated_at: new Date().toISOString(),
        }
        KPI_METRICS.forEach(m => {
          payload[m.targetKey] = parseFloat(values[m.targetKey]) || 0
          payload[`${m.targetKey}_max`] = parseFloat(maxValues[m.targetKey]) || 0
        })
        const { error } = await supabase.from('sm_targets').upsert(payload, { onConflict: 'sales_person_id,month,year' })
        if (error) throw error
        alert('Target saved successfully!')
      }

      onSaved?.()
      onClose()
    } catch (err) {
      alert('Error saving target: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="🎯 Set Target"
      onClose={onClose}
      width={760}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : mode === 'yearly' ? 'Save Annual Target' : 'Save Target'}
          </button>
        </>
      }
    >
      <div className="stm-mode-toggle">
        <button
          type="button"
          className={`stm-mode-btn ${mode === 'monthly' ? 'active' : ''}`}
          onClick={() => switchMode('monthly')}
        >
          <i className="fas fa-calendar-day"></i> Single Month
        </button>
        <button
          type="button"
          className={`stm-mode-btn ${mode === 'yearly' ? 'active' : ''}`}
          onClick={() => switchMode('yearly')}
        >
          <i className="fas fa-calendar-alt"></i> Full Year (auto-divide ÷12)
        </button>
      </div>

      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Sales Person</label>
          <select value={personId} onChange={e => setPersonId(e.target.value)}>
            {salesTeam.map(p => <option key={p.user_id} value={p.user_id}>{p.name} ({p.role})</option>)}
          </select>
        </div>
        {mode === 'monthly' ? (
          <div className="modal-form-group">
            <label>Month / Year</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))}>
                {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="modal-form-group">
            <label>Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))}>
              {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {mode === 'yearly' && (
        <div className="stm-info-banner">
          <i className="fas fa-info-circle"></i> Yahan jo bhi Target daloge wo <strong>poore saal ka</strong> maana jayega — system automatically {year} ke sabhi 12 months mein equally divide kar dega (₹/count wale KPIs ke liye). Percentage-type KPIs (jaise YoY Growth %, Overhead %) sabhi months mein same rahenge, divide nahi honge.
        </div>
      )}

      {mode === 'monthly' && maxScoreCarried && (
        <div className="stm-info-banner stm-info-sky">
          <i className="fas fa-info-circle"></i> Max Score pichle set kiye hue month se copy kiya gaya hai. Neeche edit karke is month ke liye alag rakh sakte hain.
        </div>
      )}

      {loadingExisting ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>Loading…</p>
      ) : (
        <div className="stm-table">
          <div className="stm-row stm-row-head">
            <span>KPI</span>
            <span>{mode === 'yearly' ? 'Annual Target' : 'Target'}</span>
            <span>Max Score</span>
          </div>

          {SECTIONS.map(section => (
            <div key={section.title}>
              <div className="stm-section-label">
                <i className={`fas ${section.icon}`}></i> {section.title}
              </div>
              {section.keys.map(key => {
                const m = KPI_METRICS.find(x => x.targetKey === key)
                if (!m) return null
                return (
                  <div className="stm-row" key={m.targetKey}>
                    <label className="stm-kpi-label">
                      {m.label} {m.unit === 'currency' ? <span className="stm-unit">(Rs)</span> : m.unit === 'pct' ? <span className="stm-unit">(%)</span> : null}
                    </label>
                    <input
                      type="number"
                      className="stm-input"
                      value={values[m.targetKey] ?? ''}
                      onChange={e => updateValue(m.targetKey, e.target.value)}
                      placeholder="0"
                    />
                    <input
                      type="number"
                      className="stm-input"
                      value={maxValues[m.targetKey] ?? ''}
                      onChange={e => updateMaxValue(m.targetKey, e.target.value)}
                      placeholder="e.g. 15"
                    />
                  </div>
                )
              })}
            </div>
          ))}

          <div className="stm-total-row">
            <div className="stm-total-bar-track">
              <div
                className="stm-total-bar-fill"
                style={{
                  width: `${Math.min(100, maxScoreTotal)}%`,
                  background: Math.round(maxScoreTotal) === 100 ? 'var(--green, #2d7a47)' : 'var(--rose, #be123c)',
                }}
              />
            </div>
            <span style={{ color: Math.round(maxScoreTotal) === 100 ? 'var(--green, #2d7a47)' : 'var(--rose, #be123c)' }}>
              Max Score Total: <strong>{maxScoreTotal}</strong> / 100
              {Math.round(maxScoreTotal) !== 100 && ' ⚠️'}
            </span>
          </div>
        </div>
      )}
    </Modal>
  )
}