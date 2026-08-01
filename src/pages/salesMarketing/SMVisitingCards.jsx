import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AddContactModal from '../../components/AddContactModal'
import './SMVisitingCards.css'

export default function SMVisitingCards() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddContact, setShowAddContact] = useState(false)
  const [previewCard, setPreviewCard] = useState(null)

  useEffect(() => {
    loadCards()
  }, [])

  async function loadCards() {
    setLoading(true)
    const { data } = await supabase
      .from('sm_leads')
      .select('lead_id, name, designation, company, phone, email, card_image_url, created_by, created_date')
      .not('card_image_url', 'is', null)
      .neq('card_image_url', '')
      .order('created_date', { ascending: false })
    setCards(data || [])
    setLoading(false)
  }

  function fmtDate(d) {
    if (!d) return '—'
    const date = new Date(d)
    if (isNaN(date.getTime())) return String(d)
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="fade-in">
      <div className="svc-header">
        <div>
          <h1 className="svc-title">Visiting Cards <span className="svc-count">({cards.length})</span></h1>
          <div className="svc-subtitle">Every card captured while adding a contact, in one gallery</div>
        </div>
        <button className="svc-upload-btn" onClick={() => setShowAddContact(true)}>
          <i className="fas fa-camera"></i> Upload Card
        </button>
      </div>

      {loading ? (
        <div className="svc-empty"><i className="fas fa-spinner fa-spin"></i> Loading…</div>
      ) : cards.length === 0 ? (
        <div className="svc-empty">
          <div className="svc-empty-icon">📇</div>
          <p>No visiting cards uploaded yet</p>
          <button className="svc-upload-btn" style={{ marginTop: 14 }} onClick={() => setShowAddContact(true)}>
            <i className="fas fa-camera"></i> Upload your first card
          </button>
        </div>
      ) : (
        <div className="svc-grid">
          {cards.map((c, idx) => (
            <div className="svc-card" key={c.lead_id} style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="svc-card-image" onClick={() => setPreviewCard(c)}>
                <img src={c.card_image_url} alt={c.name} loading="lazy" />
                <div className="svc-card-image-overlay">
                  <i className="fas fa-search-plus"></i>
                </div>
              </div>
              <div className="svc-card-body">
                <div className="svc-card-name">{c.name || 'Unnamed'}</div>
                {c.designation && <div className="svc-card-designation">{c.designation}</div>}
                <div className="svc-card-divider"></div>
                {c.company && <div className="svc-card-row"><i className="fas fa-building"></i> {c.company}</div>}
                {c.phone && <div className="svc-card-row svc-mono"><i className="fas fa-phone"></i> {c.phone}</div>}
                {c.email && <div className="svc-card-row"><i className="fas fa-envelope"></i> {c.email}</div>}
                <div className="svc-card-divider"></div>
                <div className="svc-card-footer">
                  <div>
                    <div className="svc-card-date">{fmtDate(c.created_date)}</div>
                    <div className="svc-card-by">by {c.created_by || 'Unknown'}</div>
                  </div>
                  <a href={c.card_image_url} target="_blank" rel="noreferrer" className="svc-view-btn" onClick={e => e.stopPropagation()}>
                    <i className="fas fa-eye"></i> View
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddContact && (
        <AddContactModal
          onClose={() => setShowAddContact(false)}
          onSaved={() => { setShowAddContact(false); loadCards() }}
        />
      )}

      {previewCard && (
        <div className="svc-lightbox" onClick={() => setPreviewCard(null)}>
          <button className="svc-lightbox-close" onClick={() => setPreviewCard(null)}>
            <i className="fas fa-times"></i>
          </button>
          <img src={previewCard.card_image_url} alt={previewCard.name} onClick={e => e.stopPropagation()} />
          <div className="svc-lightbox-caption">{previewCard.name}{previewCard.company ? ` — ${previewCard.company}` : ''}</div>
        </div>
      )}
    </div>
  )
}
