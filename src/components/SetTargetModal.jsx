import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { KPI_METRICS } from '../lib/kpiCalc'
import Modal from './Modal'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function SetTargetModal({ salesTeam, onClose, onSaved }) {
  const now = new Date()

  const [personId, setPersonId] = useState(salesTeam[0]?.user_id || '')
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
      .from('sm_targets')
      .select('*')
      .eq('sales_person_id', personId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    const initial = {}
    KPI_METRICS.forEach(m => { initial[m.targetKey] = data?.[m.targetKey] ?? '' })
    setValues(initial)
    setLoadingExisting(false)
  }

  function updateValue(key, v) {
    setValues(prev => ({ ...prev, [key]: v }))
  }

  async function handleSave() {
    if (!personId) { alert('Please select a sales person'); return }
    const person = salesTeam.find(p => p.user_id === personId)

    setSaving(true)
    try {
      const payload = {
        sales_person_id: personId,
        sales_person_name: person?.name || '',
        month,
        year,
        updated_at: new Date().toISOString(),
      }
      KPI_METRICS.forEach(m => { payload[m.targetKey] = parseFloat(values[m.targetKey]) || 0 })

      const { error } = await supabase.from('sm_targets').upsert(payload, { onConflict: 'sales_person_id,month,year' })
      if (error) throw error

      alert('Target saved successfully!')
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
      width={640}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Target'}
          </button>
        </>
      }
    >
      <div className="modal-form-row">
        <div className="modal-form-group">
          <label>Sales Person</label>
          <select value={personId} onChange={e => setPersonId(e.target.value)}>
            {salesTeam.map(p => <option key={p.user_id} value={p.user_id}>{p.name} ({p.role})</option>)}
          </select>
        </div>
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
      </div>

      {loadingExisting ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>Loading…</p>
      ) : (
        <div className="modal-form-row" style={{ flexWrap: 'wrap' }}>
          {KPI_METRICS.map(m => (
            <div className="modal-form-group" key={m.targetKey} style={{ minWidth: '45%', flex: 1 }}>
              <label>{m.label} {m.unit === 'currency' ? '(Rs)' : m.unit === 'pct' ? '(%)' : ''}</label>
              <input
                type="number"
                value={values[m.targetKey] ?? ''}
                onChange={e => updateValue(m.targetKey, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
