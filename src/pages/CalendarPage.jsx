import { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarPlus, RefreshCw, Phone, Car } from 'lucide-react';
import { getCalendarData, completeFollowUp } from '../lib/followupsApi';
import ScheduleFollowUpModal from '../components/ScheduleFollowUpModal';
import './CalendarPage.css';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const TYPE_BADGE = { Call: 'sm-badge-call', Visit: 'sm-badge-visit', WhatsApp: 'sm-badge-whatsapp', Meeting: 'sm-badge-meeting', Demo: 'sm-badge-demo' };

export default function CalendarPage({ currentUser, isAdmin = false, onUpdateFollowUp }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const salesPersonId = isAdmin ? null : currentUser?.userID;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const res = await getCalendarData(salesPersonId, month, year);
    if (res.success) setEvents(res.data);
    else { setLoadError(res.message || 'Failed to load calendar data'); console.error('getCalendarData error:', res.message); }
    setLoading(false);
  }, [salesPersonId, month, year]);

  useEffect(() => { load(); }, [load]);

  function changeMonth(dir) {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  const filteredEvents = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return events;
    return events.filter((ev) =>
      (ev.leadName || '').toLowerCase().includes(s) ||
      (ev.company || '').toLowerCase().includes(s) ||
      (ev.notes || '').toLowerCase().includes(s)
    );
  }, [events, search]);

  const eventMap = useMemo(() => {
    const map = {};
    filteredEvents.forEach((ev) => {
      const d = new Date(ev.followUpDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[key] ||= []).push(ev);
    });
    return map;
  }, [filteredEvents]);

  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const todayEvents = eventMap[todayKey] || [];
  const todayCalls = todayEvents.filter((e) => e.type !== 'Visit');
  const todayVisits = todayEvents.filter((e) => e.type === 'Visit');

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  async function handleClose(followUpId) {
    await completeFollowUp(followUpId);
    load();
  }

  return (
    <div className="fade-in calp-page">
      <div className="calp-header">
        <div className="calp-title">Calendar</div>
        <div className="calp-header-actions">
          <button className="sm-btn sm-btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>
          <button className="sm-btn sm-btn-primary" onClick={() => setScheduleOpen(true)}><CalendarPlus size={14} /> Schedule</button>
        </div>
      </div>

      {loadError && <div className="calp-error">⚠️ {loadError}</div>}

      <div className="calp-search-bar">
        <i className="fas fa-search"></i>
        <input placeholder="Search lead name, company, notes…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="calp-grid">
        {/* Month grid */}
        <div className="calp-card">
          <div className="calp-month-header">
            <button className="sm-btn sm-btn-ghost calp-nav-btn" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
            <span className="calp-month-label">{MONTHS[month]} {year}</span>
            <button className="sm-btn sm-btn-ghost calp-nav-btn" onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
          </div>

          <div className="calp-weekdays-row">
            {DAYS.map((d) => (
              <div key={d} className="calp-weekday">{d}</div>
            ))}
          </div>
          <div className="calp-weekdays-row" key={`${year}-${month}`}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} className="sm-cal-day empty" />;
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const key = `${year}-${month}-${day}`;
              const dayEvents = eventMap[key] || [];
              return (
                <div key={idx} className={`sm-cal-day${isToday ? ' today' : ''}`}>
                  <div className={`calp-day-number${isToday ? ' today' : ''}`}>{day}</div>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div key={ev.followUpID} className={`sm-cal-event ${TYPE_BADGE[ev.type] || 'sm-badge-call'}`} title={`${ev.leadName} - ${ev.type}`}>
                      {ev.type === 'Visit' ? <Car size={9} /> : <Phone size={9} />} {ev.leadName}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="calp-more">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: today's follow-ups / visits */}
        <div className="calp-sidebar">
          <SidebarCard title={`Today's Follow-ups (${todayCalls.length})`} icon={<Phone size={14} />}>
            {todayCalls.length === 0 && <Empty text="No calls today" />}
            {todayCalls.map((ev) => (
              <EventCard key={ev.followUpID} ev={ev} onClose={handleClose} onUpdate={onUpdateFollowUp} isAdmin={isAdmin} />
            ))}
          </SidebarCard>

          <SidebarCard title={`Today's Visits (${todayVisits.length})`} icon={<Car size={14} />}>
            {todayVisits.length === 0 && <Empty text="No visits today" />}
            {todayVisits.map((ev) => (
              <EventCard key={ev.followUpID} ev={ev} visit onClose={handleClose} onUpdate={onUpdateFollowUp} isAdmin={isAdmin} />
            ))}
          </SidebarCard>
        </div>
      </div>

      <ScheduleFollowUpModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onScheduled={load}
        currentUser={currentUser}
      />
    </div>
  );
}

function SidebarCard({ title, icon, children }) {
  return (
    <div className="calp-card">
      <h3 className="calp-card-title">{icon}{title}</h3>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <p className="calp-empty">{text}</p>;
}

function EventCard({ ev, visit, onClose, onUpdate, isAdmin }) {
  return (
    <div
      className="calp-event-card"
      style={{
        background: visit ? 'var(--sm-warning-bg)' : 'var(--sm-bg-hover)',
        borderLeft: visit ? '3px solid var(--sm-warning)' : undefined,
        border: visit ? undefined : '1px solid var(--sm-border)',
      }}
    >
      <div className="calp-event-name">{ev.leadName}</div>
      <div className="calp-event-meta-row">
        {isAdmin && ev.salesPerson && (
          <span className="sm-badge calp-badge-owner" title="ASSIGNED SALES PERSON — this follow-up belongs to this team member">
            👤 {ev.salesPerson}
          </span>
        )}
        <span className={`sm-badge ${TYPE_BADGE[ev.type] || 'sm-badge-call'}`}>{ev.type}</span>
        {ev.followUpTime && <span className="calp-event-time">{formatTime(ev.followUpTime)}</span>}
      </div>
      {visit && ev.visitNumber && (
        <div className="calp-event-visit">{ev.visitNumber} Visit</div>
      )}
      {ev.location && <div className="calp-event-location">📍 {ev.location}</div>}
      {ev.notes && <div className="calp-event-notes">{ev.notes}</div>}
      <div className="calp-event-actions">
        <button className="sm-btn sm-btn-primary" onClick={() => onUpdate?.(ev)}>
          🔄 Update Follow-up
        </button>
      </div>
    </div>
  );
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}