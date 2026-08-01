import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSMAuth } from '../context/SMAuthContext'
import './SMNotificationPopup.css'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/**
 * Polls sm_notifications for the logged-in Sales/Marketing user and pops up
 * a modal the moment a contact gets assigned/reassigned to them.
 * Mounted once inside SMDashboardLayout, so it's live on every SM page.
 */
export default function SMNotificationPopup() {
  const { smUser } = useSMAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState([])
  const [showModal, setShowModal] = useState(false)
  const dismissedForNowRef = useRef(false)

  useEffect(() => {
    if (!smUser?.name) return
    checkUnread()
    const interval = setInterval(checkUnread, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smUser?.name])

  async function checkUnread() {
    const { data } = await supabase
      .from('sm_notifications')
      .select('*')
      .eq('recipient_name', smUser.name)
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
    await supabase.from('sm_notifications').update({ is_read: true }).eq('id', notif.id)
    const remaining = notifications.filter(n => n.id !== notif.id)
    setNotifications(remaining)
    if (remaining.length === 0) setShowModal(false)

    const targetPath = '/sales-marketing/my-leads'
    if (location.pathname === targetPath) {
      window.location.reload()
    } else {
      navigate(targetPath)
    }
  }

  async function handleDismiss(notif) {
    await supabase.from('sm_notifications').update({ is_read: true }).eq('id', notif.id)
    setNotifications(prev => {
      const next = prev.filter(n => n.id !== notif.id)
      if (next.length === 0) setShowModal(false)
      return next
    })
  }

  async function handleDismissAll() {
    const ids = notifications.map(n => n.id)
    await supabase.from('sm_notifications').update({ is_read: true }).in('id', ids)
    setNotifications([])
    setShowModal(false)
  }

  function handleClose() {
    dismissedForNowRef.current = true
    setShowModal(false)
  }

  if (!showModal || notifications.length === 0) return null

  return (
    <div className="smnp-overlay" onClick={handleClose}>
      <div className="smnp-modal" onClick={e => e.stopPropagation()}>
        <div className="smnp-header">
          <span><i className="fas fa-bell"></i> New Assignments <span className="smnp-count">{notifications.length}</span></span>
          <div className="smnp-header-actions">
            <button className="smnp-dismiss-all-btn" onClick={handleDismissAll}>Dismiss All</button>
            <button className="smnp-close-btn" onClick={handleClose}><i className="fas fa-times"></i></button>
          </div>
        </div>

        <div className="smnp-list">
          {notifications.map((notif, i) => (
            <div key={notif.id} className="smnp-item" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="smnp-item-icon"><i className="fas fa-user-plus"></i></div>
              <div className="smnp-item-body">
                <div className="smnp-item-title">{notif.title || 'New Contact Assigned'}</div>
                <div className="smnp-item-message">{notif.message}</div>
                <div className="smnp-item-meta">
                  <span className="smnp-item-time">{timeAgo(notif.created_at)}</span>
                </div>
              </div>
              <div className="smnp-item-actions">
                <button className="smnp-view-btn" onClick={() => handleView(notif)}>View Contact</button>
                <button className="smnp-dismiss-btn" onClick={() => handleDismiss(notif)} title="Dismiss">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
