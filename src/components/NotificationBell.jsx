import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import './NotificationBell.css'

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!user?.name) return
    loadNotifications()
    intervalRef.current = setInterval(loadNotifications, 30000) // har 30 sec check karo
    return () => clearInterval(intervalRef.current)
  }, [user?.name])

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_name', user.name)
      .order('created_at', { ascending: false })
      .limit(20)

    setNotifications(data || [])
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function handleNotificationClick(notif) {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    }
    setOpen(false)
    if (notif.enquiry_id) {
      const targetPath = `/enquiries/${notif.enquiry_id}`
      if (location.pathname === targetPath) {
        window.location.reload()
      } else {
        navigate(targetPath)
      }
    }
  }

  async function handleMarkAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="nb-wrap">
      <button className="nb-bell-btn" onClick={() => setOpen(o => !o)} title="Notifications">
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && <span className="nb-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <>
          <div className="nb-overlay" onClick={() => setOpen(false)}></div>
          <div className="nb-panel">
            <div className="nb-panel-header">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <button className="nb-mark-read" onClick={handleMarkAllRead}>Mark all read</button>
              )}
            </div>

            <div className="nb-list">
              {notifications.length === 0 ? (
                <div className="nb-empty">
                  <i className="fas fa-bell-slash"></i>
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={`nb-item ${!n.is_read ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {!n.is_read && <div className="nb-dot"></div>}
                    <div className="nb-item-icon"><i className="fas fa-inbox"></i></div>
                    <div className="nb-item-body">
                      <div className="nb-item-msg">
                        {n.title && <strong style={{ display: 'block', marginBottom: 2 }}>{n.title}</strong>}
                        {n.message}
                      </div>
                      <div className="nb-item-meta">
                        {n.enquiry_id && <span className="nb-item-enq">{n.enquiry_id}</span>}
                        <span className="nb-item-time">{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}