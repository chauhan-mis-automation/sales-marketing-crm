import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MARKETING_KRAS } from '../lib/marketingKpiCalc'
import MonthYearPicker from './MonthYearPicker'
import Modal from './Modal'
import './SetMarketingTargetModal.css'

export default function SetMarketingTargetModal({ marketingTeam, onClose, onSaved }) {
  const now = new Date()

  const [personId, setPersonId] = useState(marketingTeam[0]?.user_id || '')
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)

  useEffect(() => {
    loadExisting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, month, year])

  async function loadExisting() {
    if (!personId) return
    setLoadingExisting(true)
    const { data } = await supabase
      .from('sm_marketing_targets')
      .select('*')
      .eq('marketing_person_id', personId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    const initial = {}
    MARKETING_KRAS.forEach(k => {
      initial[k.targetKey] = data ? (data[k.targetKey] ?? k.defaultTarget) : k.defaultTarget
      initial[k.weightKey] = data ? (data[k.weightKey] ?? k.defaultWeight) : k.defaultWeight
    })
    setValues(initial)
    setLoadingExisting(false)
  }

  function updateValue(key, v) {
    setValues(prev => ({ ...prev, [key]: v }))
  }

  const weightTotal = MARKETING_KRAS.reduce((sum, k) => sum + (parseFloat(values[k.weightKey]) || 0), 0)
  const weightColor = weightTotal === 100 ? '#2d7a47' : weightTotal > 100 ? '#be123c' : '#b8860b'

  async function handleSave() {
    if (!personId) { alert('Please select a Marketing person'); return }
    if (weightTotal !== 100) { alert(`Total Weightage must equal 100! Currently: ${weightTotal}`); return }

    const person = marketingTeam.find(p => p.user_id === personId)

    setSaving(true)
    try {
      const payload = {
        marketing_person_id: personId,
        marketing_person_name: person?.name || '',
        month,
        year,
        updated_at: new Date().toISOString(),
      }
      MARKETING_KRAS.forEach(k => {
        payload[k.targetKey] = parseFloat(values[k.targetKey]) || 0
        payload[k.weightKey] = parseFloat(values[k.weightKey]) || 0
      })

      const { error } = await supabase
        .from('sm_marketing_targets')
        .upsert(payload, { onConflict: 'marketing_person_id,month,year' })
      if (error) throw error

      alert('Marketing Target saved successfully!')
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
      title="🎯 Set / Edit Marketing KPI Target"
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Targets'}
          </button>
        </>
      }
    >
      <div className="smt-info-banner">
        <i className="fas fa-info-circle"></i>
        Set both <strong>Target</strong> (what to achieve) and <strong>Weightage %</strong> (importance) for each KRA.
        All weightages together should add up to <strong>100%</strong>.
      </div>

      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Marketing Person *</label>
          <select value={personId} onChange={e => setPersonId(e.target.value)}>
            {marketingTeam.map(p => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
          </select>
        </div>
        <div className="modal-form-group">
          <label>Month / Year *</label>
          <MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
        </div>
      </div>

      <div className="smt-weight-total" style={{ borderColor: weightColor }}>
        <span>Total Weightage</span>
        <div className="smt-weight-bar-wrap">
          <div className="smt-weight-bar" style={{ width: `${Math.min(weightTotal, 100)}%`, background: weightColor }}></div>
        </div>
        <span style={{ color: weightColor, fontWeight: 800 }}>{weightTotal} / 100</span>
      </div>

      {loadingExisting ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>Loading…</p>
      ) : (
        MARKETING_KRAS.map((kra, idx) => (
          <div className="smt-kra-row" key={kra.key}>
            <div className="smt-kra-head">
              <span className="smt-kra-num">{idx + 1}</span>
              <span className="smt-kra-label"><i className={`fas ${kra.icon}`}></i> {kra.label}</span>
              <span className="smt-kra-timeline">{kra.timeline}</span>
            </div>
            <div className="smt-kra-inputs">
              <div className="modal-form-group" style={{ marginBottom: 0 }}>
                <label>🎯 Target{kra.unit === 'pct' ? ' (%)' : ''}</label>
                <input
                  type="number"
                  value={values[kra.targetKey] ?? ''}
                  onChange={e => updateValue(kra.targetKey, e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="modal-form-group" style={{ marginBottom: 0 }}>
                <label>⚖️ Weightage %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={values[kra.weightKey] ?? ''}
                  onChange={e => updateValue(kra.weightKey, e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        ))
      )}
    </Modal>
  )
}
