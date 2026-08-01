import './Modal.css'

export default function Modal({ title, onClose, children, footer, width }) {
  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div
        className="modal"
        style={width ? { maxWidth: width } : undefined}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
