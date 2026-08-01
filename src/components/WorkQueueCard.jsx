export default function WorkQueueCard({ count, emptyMessage = 'No pending tasks! All caught up. 🎉', children }) {
  return (
    <>
      <div className="workqueue-card">
        <div className="workqueue-left">
          <div className="workqueue-icon">📋</div>
          <div>
            <div className="workqueue-title">Today's Work Queue</div>
            <div className="workqueue-date">
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
        <div className="workqueue-badge">
          {count > 0 ? `${count} pending` : 'All Clear ✓'}
        </div>
      </div>

      {count === 0 ? (
        <div className="workqueue-empty">
          <i className="fas fa-check-circle"></i>
          {emptyMessage}
        </div>
      ) : (
        <div className="card" style={{ marginTop: -20 }}>
          {children}
        </div>
      )}
    </>
  )
}
