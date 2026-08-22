import Modal from './Modal'

// Generic Yes/No confirmation popup — reusable kahin bhi — PO approval, GA
// Drawing, etc. — jahan bhi "kya aap sach mein karna chahte hain?" poochna ho.
export default function ConfirmModal({ title, message, confirmLabel = 'Yes', cancelLabel = 'No', onConfirm, onCancel }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={440}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn-modal-primary" onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--text2, #3a4033)', lineHeight: 1.6, margin: 0 }}>{message}</p>
    </Modal>
  )
}