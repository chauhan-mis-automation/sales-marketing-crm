import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, CalendarPlus, RefreshCw } from 'lucide-react';
import { getFollowUps, completeFollowUp } from '../lib/followupsApi';
import ScheduleFollowUpModal from '../components/ScheduleFollowUpModal';
import './FollowUpsPage.css';

const TABS = ['Today', 'Overdue', 'Upcoming', 'All'];
const TYPE_BADGE = { Call: 'sm-badge-call', Visit: 'sm-badge-visit', WhatsApp: 'sm-badge-whatsapp', Meeting: 'sm-badge-meeting', Demo: 'sm-badge-demo' };

export default function FollowUpsPage({ currentUser, isAdmin = false, onUpdateFollowUp }) {
  const [all, setAll] = useState([]);
  const [tab, setTab] = useState('Today');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [ratingFilter, setRatingFilter] = useState('All');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const salesPersonId = isAdmin ? null : currentUser?.userID;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const res = await getFollowUps(salesPersonId ? { salesPersonId } : {});
    if (res.success) setAll(res.data);
    else { setLoadError(res.message || 'Failed to load follow-ups'); console.error('getFollowUps error:', res.message); }
    setLoading(false);
  }, [salesPersonId]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const todayStr = now.toDateString();

  const counts = useMemo(() => {
    const c = { Today: 0, Overdue: 0, Upcoming: 0, All: 0 };
    all.forEach((f) => {
      if (!matchesFilters(f, search, typeFilter, ratingFilter)) return;
      c.All++;
      if (f.status !== 'Pending') return;
      const d = new Date(f.followUpDate);
      const dStr = d.toDateString();
      if (dStr === todayStr) c.Today++;
      else if (d < now) c.Overdue++;
      else if (d > now) c.Upcoming++;
    });
    return c;
  }, [all, search, typeFilter, ratingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    return all.filter((f) => {
      if (!matchesFilters(f, search, typeFilter, ratingFilter)) return false;
      const d = new Date(f.followUpDate);
      const dStr = d.toDateString();

      if (tab !== 'All' && f.status !== 'Pending') return false;
      if (tab === 'Today') return dStr === todayStr;
      if (tab === 'Overdue') return d < now && dStr !== todayStr;
      if (tab === 'Upcoming') return d > now && dStr !== todayStr;
      return true; // All
    });
  }, [all, tab, search, typeFilter, ratingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClose(followUpId) {
    await completeFollowUp(followUpId);
    load();
  }

  return (
    <div className="fade-in">
      <div className="fup-header">
        <div className="fup-title">Follow-ups</div>
        <div className="fup-header-actions">
          <button className="sm-btn sm-btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>
          <button className="sm-btn sm-btn-primary" onClick={() => setScheduleOpen(true)}><CalendarPlus size={14} /> Schedule</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="fup-filterbar">
        <span className="fup-filter-label">FILTER BY:</span>
        <div className="fup-search-wrap">
          <Search size={14} className="fup-search-icon" />
          <input
            className="sm-input fup-search-input"
            placeholder="Search name, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="sm-input fup-type-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="All">All Types</option>
          <option value="Visit">Visit</option>
          <option value="Call">Call</option>
        </select>
        <select className="sm-input fup-type-select" value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
          <option value="All">All Ratings</option>
          <option value="Pro">Pro</option>
          <option value="Neutral">Neutral</option>
          <option value="Anti">Anti</option>
          <option value="Yet to meet">Yet to meet</option>
        </select>
        <button className="sm-btn sm-btn-ghost" onClick={() => { setSearch(''); setTypeFilter('All'); setRatingFilter('All'); }}>Reset</button>
      </div>

      {/* Tabs */}
      <div className="fup-tabs">
        {TABS.map((t) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            className={`fup-tab${tab === t ? ' active' : ''}`}
          >
            {t} ({counts[t]})
          </div>
        ))}
      </div>

      {/* List */}
      {loadError && <div className="fup-error">⚠️ {loadError}</div>}
      {loading ? (
        <div className="fup-loading">Loading...</div>
      ) : visible.length === 0 ? (
        <div className="fup-empty">
          <div className="fup-empty-icon">✅</div>
          <p style={{ color: 'var(--sm-text-muted)' }}>No follow-ups match these filters</p>
        </div>
      ) : (
        <div className="fup-list">
          {visible.map((f) => (
            <FollowUpRow key={f.followUpID} f={f} onClose={handleClose} onUpdate={onUpdateFollowUp} />
          ))}
        </div>
      )}

      <ScheduleFollowUpModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onScheduled={load}
        currentUser={currentUser}
      />
    </div>
  );
}

function matchesFilters(f, search, typeFilter, ratingFilter) {
  const typeOk = typeFilter === 'All' || f.type === typeFilter;
  const ratingOk = !ratingFilter || ratingFilter === 'All' || f.rating === ratingFilter;
  const s = search.toLowerCase().trim();
  const searchOk =
    !s ||
    (f.leadName || '').toLowerCase().includes(s) ||
    (f.company || '').toLowerCase().includes(s) ||
    (f.notes || '').toLowerCase().includes(s) ||
    (f.location || '').toLowerCase().includes(s);
  return typeOk && ratingOk && searchOk;
}

const RATING_BADGE = { Pro: 'sm-badge-done', Neutral: 'sm-badge-meeting', Anti: 'sm-badge-danger', 'Yet to meet': 'sm-badge-call' };
const VOLUME_TOOLTIP = {
  High: 'BUSINESS VOLUME: HIGH — LARGE DEAL POTENTIAL',
  Medium: 'BUSINESS VOLUME: MEDIUM — MODERATE DEAL POTENTIAL',
  Low: 'BUSINESS VOLUME: LOW — SMALL DEAL POTENTIAL',
};

function FollowUpRow({ f, onClose, onUpdate }) {
  const borderColor = f.type === 'Visit' ? 'var(--sm-warning)' : 'var(--sm-info)';
  return (
    <div className="fup-row" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="fup-row-inner">
        <div className="fup-row-main">
          <div className="fup-row-name">
            {f.leadName}{f.company ? <span className="fup-row-company"> — {f.company}</span> : ''}
          </div>
          <div className="fup-row-badges">
            <span className={`sm-badge ${TYPE_BADGE[f.type] || 'sm-badge-call'}`}>{f.type}</span>
            {f.rating && <span className={`sm-badge ${RATING_BADGE[f.rating] || 'sm-badge-call'}`} title={`ENGAGEMENT: ${f.rating.toUpperCase()}`}>{f.rating.toUpperCase()}</span>}
            <span className={`sm-badge ${f.status === 'Done' ? 'sm-badge-done' : 'sm-badge-pending'}`}>{f.status.toUpperCase()}</span>
            {f.businessVolume && (
              <span className="sm-badge sm-badge-volume" title={VOLUME_TOOLTIP[f.businessVolume] || `BUSINESS VOLUME: ${f.businessVolume.toUpperCase()}`}>
                💰 {f.businessVolume.toUpperCase()}
              </span>
            )}
          </div>
          {f.visitNumber && (
            <div className="fup-row-visit">🔁 {f.visitNumber} Visit</div>
          )}
          <div className="fup-row-meta">
            📅 {formatDate(f.followUpDate)} {f.followUpTime ? `⏰ ${formatTime(f.followUpTime)}` : ''} {f.location ? `📍 ${f.location}` : ''}
          </div>
          {f.notes && <div className="fup-row-notes">{f.notes}</div>}
        </div>
        <div className="fup-row-actions">
          <button className="sm-btn sm-btn-primary" onClick={() => onUpdate?.(f)}>🔄 Update Follow-up</button>
          <button className="sm-btn sm-btn-ghost" onClick={() => onClose(f.followUpID)}>✅ Close</button>
        </div>
      </div>
    </div>
  );
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
