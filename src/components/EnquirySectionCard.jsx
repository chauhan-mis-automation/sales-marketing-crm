export default function EnquirySectionCard({ icon, title, count, headerAction, emptyIcon, emptyText, emptySubtext, children }) {
  return (
    <div className="ed-card">
      <div className="ed-card-header ed-section-header">
        <span className="ed-card-title">
          {icon} {title}{count !== undefined ? ` (${count})` : ''}
        </span>
        {headerAction && <div className="ed-section-action">{headerAction}</div>}
      </div>
      <div className="ed-card-body">
        {children ? children : (
          <div className="ed-empty-mini">
            <i className={`fas ${emptyIcon}`}></i>
            <p>{emptyText}</p>
            {emptySubtext && <p className="ed-empty-sub">{emptySubtext}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
