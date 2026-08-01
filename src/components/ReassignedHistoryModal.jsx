import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import Modal from './Modal'

function fmtDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return String(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function ReassignedHistoryModal({ userId, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function loadHistory() {
    setLoading(true)
    const { data } = await supabase
      .from('sm_activity_log')
      .select('*')
      .eq('user_id', userId)
      .eq('action', 'ASSIGN_LEAD')
      .order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  return (
    <Modal
      title="🔄 My Reassignment History"
      onClose={onClose}
      width={560}
      footer={<button className="btn-modal-ghost" onClick={onClose}>Close</button>}
    >
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}><i className="fas fa-spinner fa-spin"></i> Loading…</p>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔄</div>
          <p>You haven't assigned any contacts yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => (
            <div key={r.id} style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 14px',
            }}>
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>{r.lead_name || '—'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--slate-600)', marginTop: 2 }}>{r.details}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{fmtDate(r.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
