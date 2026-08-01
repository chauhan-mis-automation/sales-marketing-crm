import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import './NotificationPopup.css'

// Har notification type ke liye alag look — color, icon, button text
const TYPE_CONFIG = {
  assignment: { color: '#0369a1', icon: 'fa-info-circle', confirmText: 'View Enquiry' },
  followup_reminder: { color: '#0369a1', icon: 'fa-clipboard-list', confirmText: 'View Enquiry' },
  rejection: { color: '#be123c', icon: 'fa-times', confirmText: 'View Enquiry' },
  approval: { color: '#059669', icon: 'fa-check', confirmText: 'View Enquiry' },
  ga_new_task: { color: '#0369a1', icon: 'fa-drafting-compass', confirmText: 'View Enquiry' },
  ga_review: { color: '#0369a1', icon: 'fa-drafting-compass', confirmText: 'View Enquiry' },
  ga_resubmitted: { color: '#b45309', icon: 'fa-exclamation', confirmText: 'View Enquiry' },
  ga_approved: { color: '#059669', icon: 'fa-check', confirmText: 'View Enquiry' },
  ga_rejected: { color: '#be123c', icon: 'fa-times', confirmText: 'View Enquiry' },
  ga_client_changes: { color: '#b45309', icon: 'fa-exclamation', confirmText: 'View Enquiry' },
  po_review: { color: '#6d28d9', icon: 'fa-file-alt', confirmText: 'View Enquiry' },
  po_approved: { color: '#059669', icon: 'fa-check', confirmText: 'View Enquiry' },
  po_rejected: { color: '#be123c', icon: 'fa-times', confirmText: 'View Enquiry' },
  po_reassigned: { color: '#6d28d9', icon: 'fa-file-alt', confirmText: 'View Enquiry' },
  wo_new_task: { color: '#0369a1', icon: 'fa-clipboard-list', confirmText: 'View Enquiry' },
  questionnaire: { color: '#b45309', icon: 'fa-file-alt', confirmText: 'View Enquiry' },
}
const DEFAULT_CONFIG = { color: '#0369a1', icon: 'fa-info-circle', confirmText: 'View Enquiry' }

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationPopup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState([])
  const [showModal, setShowModal] = useState(false)
  const dismissedForNowRef = useRef(false)

  useEffect(() => {
    if (!user?.name) return
    checkUnread()
    const interval = setInterval(checkUnread, 15000)
    return () => clearInterval(interval)
  }, [user?.name])

  async function checkUnread() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_name', user.name)
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      setNotifications(data)
      // Agar user ne abhi-abhi "Close" karke band kiya hai, to turant dobara mat kholo —
      // agli 15-second poll pe naya notification aaye tabhi phir se dikhao.
      if (!dismissedForNowRef.current) setShowModal(true)
    } else {
      setNotifications([])
      setShowModal(false)
      dismissedForNowRef.current = false
    }
  }

  async function handleView(notif) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
    const remaining = notifications.filter(n => n.id !== notif.id)
    setNotifications(remaining)
    if (remaining.length === 0) setShowModal(false)

    if (notif.enquiry_id) {
      const targetPath = `/enquiries/${notif.enquiry_id}`
      if (location.pathname === targetPath) {
        // Already isi enquiry page pe ho — sirf navigate karne se data refresh nahi hoga
        window.location.reload()
      } else {
        navigate(targetPath)
      }
    }
  }

  async function handleDismiss(notif) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
    setNotifications(prev => {
      const next = prev.filter(n => n.id !== notif.id)
      if (next.length === 0) setShowModal(false)
      return next
    })
  }

  async function handleDismissAll() {
    const ids = notifications.map(n => n.id)
    await supabase.from('notifications').update({ is_read: true }).in('id', ids)
    setNotifications([])
    setShowModal(false)
  }

  function handleClose() {
    // Sirf modal band karo, notifications ko "read" mat karo — agli baar bell ya
    // agle poll pe wapas dikhengi jab tak explicitly view/dismiss na kiya jaye.
    dismissedForNowRef.current = true
    setShowModal(false)
  }

  if (!showModal || notifications.length === 0) return null

  return (
    <div className="np-overlay" onClick={handleClose}>
      <div className="np-modal" onClick={e => e.stopPropagation()}>
        <div className="np-header">
          <span><i className="fas fa-bell"></i> Notifications <span className="np-count">{notifications.length}</span></span>
          <div className="np-header-actions">
            <button className="np-dismiss-all-btn" onClick={handleDismissAll}>Dismiss All</button>
            <button className="np-close-btn" onClick={handleClose}><i className="fas fa-times"></i></button>
          </div>
        </div>

        <div className="np-list">
          {notifications.map((notif, i) => {
            const cfg = TYPE_CONFIG[notif.type] || DEFAULT_CONFIG
            return (
              <div key={notif.id} className="np-item" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="np-item-icon" style={{ borderColor: cfg.color, color: cfg.color }}>
                  <i className={`fas ${cfg.icon}`}></i>
                </div>
                <div className="np-item-body">
                  <div className="np-item-title">{notif.title || 'Notification'}</div>
                  <div className="np-item-message">{notif.message}</div>
                  <div className="np-item-meta">
                    {notif.enquiry_id && <span className="np-item-enq">{notif.enquiry_id}</span>}
                    <span className="np-item-time">{timeAgo(notif.created_at)}</span>
                  </div>
                </div>
                <div className="np-item-actions">
                  <button className="np-view-btn" style={{ background: cfg.color }} onClick={() => handleView(notif)}>
                    {cfg.confirmText}
                  </button>
                  <button className="np-dismiss-btn" onClick={() => handleDismiss(notif)} title="Dismiss">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
