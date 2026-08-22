import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { KPI_METRICS, getMaxScore } from '../lib/kpiCalc'
import Modal from './Modal'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ViewTargetsModal({ onClose }) {
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTargets()
  }, [])

  async function loadTargets() {
    setLoading(true)
    const { data } = await supabase
      .from('sm_targets')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    setTargets(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this target?')) return
    await supabase.from('sm_targets').delete().eq('id', id)
    loadTargets()
  }

  return (
    <Modal
      title="📋 All Targets"
      onClose={onClose}
      width={900}
      footer={<button className="btn-modal-ghost" onClick={onClose}>Close</button>}
    >
      <div style={{ overflowX: 'auto' }}>
        <table className="scp-table" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th>Sales Person</th><th>Period</th>
              {KPI_METRICS.map(m => <th key={m.targetKey}>{m.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={17} style={{ textAlign: 'center', padding: 20 }}><i className="fas fa-spinner fa-spin"></i></td></tr>
            ) : targets.length === 0 ? (
              <tr><td colSpan={17} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No targets set yet</td></tr>
            ) : targets.map(t => (
              <tr key={t.id}>
                <td><strong>{t.sales_person_name}</strong></td>
                <td className="scp-mono">{MONTH_NAMES[t.month]} {t.year}</td>
                {KPI_METRICS.map(m => (
                  <td key={m.targetKey} className="scp-mono">
                    {t[m.targetKey]}
                    <span style={{ color: 'var(--muted)', fontSize: 10.5 }}> (max: {getMaxScore(t, m.targetKey)})</span>
                  </td>
                ))}
                <td>
                  <button className="scp-view-btn" onClick={() => handleDelete(t.id)} title="Delete">
                    <i className="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}