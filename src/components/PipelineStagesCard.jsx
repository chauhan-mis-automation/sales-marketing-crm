import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildPipelineLanes } from '../lib/pipelineHelpers'
import './PipelineStagesCard.css'

export default function PipelineStagesCard({ enquiries, stages, getDisplayAmount, title = '⚡ Pipeline Stages' }) {
  const navigate = useNavigate()
  const scrollRef = useRef(null)

  const lanes = useMemo(
    () => buildPipelineLanes(enquiries, stages, getDisplayAmount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enquiries, stages]
  )

  function scrollLanes(dir) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * 460, behavior: 'smooth' })
  }

  function handleWheel(e) {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollWidth <= el.clientWidth) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {lanes.filter(l => l.items.length > 0).length} active stages
          </span>
          <div className="pipeline-nav-btns">
            <button onClick={() => scrollLanes(-1)} title="Scroll left"><i className="fas fa-chevron-left"></i></button>
            <button onClick={() => scrollLanes(1)} title="Scroll right"><i className="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="pipeline-scroll" ref={scrollRef} onWheel={handleWheel}>
          {lanes.length === 0 ? (
            <div className="pipeline-empty" style={{ width: '100%' }}>
              <i className="fas fa-info-circle"></i>
              No stages configured in Dropdown List yet.
            </div>
          ) : (
            lanes.map(lane => (
              <div className="pipeline-lane" key={lane.name}>
                <div className="pipeline-lane-header">
                  <span className="pipeline-lane-title" title={lane.name}>{lane.name}</span>
                  <span
                    className="pipeline-lane-count"
                    style={{ background: `${lane.color}18`, color: lane.color, border: `1px solid ${lane.color}33` }}
                  >
                    {lane.items.length} ticket{lane.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="pipeline-lane-accent" style={{ background: lane.color }}></div>
                {lane.total > 0 && (
                  <div className="pipeline-lane-total">₹{lane.total.toLocaleString('en-IN')} total</div>
                )}
                <div className="pipeline-lane-body">
                  {lane.items.length === 0 ? (
                    <div className="pipeline-empty">
                      <i className="fas fa-inbox"></i>
                      No enquiries
                    </div>
                  ) : (
                    lane.items.slice(0, 8).map((item, idx) => {
                      const initials = (item.contact_name || item.company_name || '?')
                        .split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
                      return (
                        <div
                          key={item.enquiry_id}
                          className="pipeline-mini-card"
                          style={{ animationDelay: `${idx * 45}ms` }}
                          onClick={() => navigate(`/enquiries/${item.enquiry_id}`)}
                        >
                          <div className="pipeline-mini-id">{item.enquiry_id}</div>
                          <div className="pipeline-mini-company">{item.company_name || '—'}</div>
                          <div className="pipeline-mini-contact">{item.contact_name || '—'}</div>
                          {item.displayAmount ? (
                            <div className="pipeline-mini-amount">₹{Number(item.displayAmount).toLocaleString('en-IN')}</div>
                          ) : null}
                          <div className="pipeline-mini-footer">
                            <span className="pipeline-mini-phone">
                              {item.phone ? `${item.country_code || ''} ${item.phone}` : '—'}
                            </span>
                            <span className="pipeline-mini-avatar" style={{ background: lane.color }}>{initials}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                  {lane.items.length > 8 && (
                    <div className="pipeline-mini-more">+{lane.items.length - 8} more</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
