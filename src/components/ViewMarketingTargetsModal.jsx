import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MARKETING_KRAS } from '../lib/marketingKpiCalc'
import Modal from './Modal'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ViewMarketingTargetsModal({ onClose }) {
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTargets()
  }, [])

  async function loadTargets() {
    setLoading(true)
    const { data } = await supabase
      .from('sm_marketing_targets')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    setTargets(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this target?')) return
    await supabase.from('sm_marketing_targets').delete().eq('id', id)
    loadTargets()
  }

  return (
    <Modal
      title="📋 All Marketing Targets"
      onClose={onClose}
      width={1000}
      footer={<button className="btn-modal-ghost" onClick={onClose}>Close</button>}
    >
      <div style={{ overflowX: 'auto' }}>
        <table className="scp-table" style={{ minWidth: 1250 }}>
          <thead>
            <tr>
              <th>Marketing Person</th>
              <th>Period</th>
              {MARKETING_KRAS.map(k => <th key={k.key}>{k.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={18} style={{ textAlign: 'center', padding: 20 }}><i className="fas fa-spinner fa-spin"></i></td></tr>
            ) : targets.length === 0 ? (
              <tr><td colSpan={18} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No marketing targets set yet</td></tr>
            ) : targets.map(t => (
              <tr key={t.id}>
                <td><strong>{t.marketing_person_name}</strong></td>
                <td className="scp-mono">{MONTH_NAMES[t.month]} {t.year}</td>
                {MARKETING_KRAS.map(k => (
                  <td key={k.key} className="scp-mono">
                    {t[k.targetKey]}{k.unit === 'pct' ? '%' : ''}
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)' }}>{t[k.weightKey]}%</span>
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
