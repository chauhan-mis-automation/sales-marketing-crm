import { useState } from 'react';
import { X } from 'lucide-react';
import ContactSearchSelect from './ContactSearchSelect';
import { addFollowUp } from '../lib/followupsApi';
import './ScheduleFollowUpModal.css';

/**
 * "Schedule Follow-up / Visit" modal — matches the Apps Script #followUpModal.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onScheduled: (newFollowUp) => void   // call this to refresh Calendar / Follow-ups list
 *  - currentUser: { name, userID }
 *  - lead: { leadId, leadName } | null    // pre-fill when opened from a lead card
 */
export default function ScheduleFollowUpModal({ open, onClose, onScheduled, currentUser, lead = null }) {
  const [contact, setContact] = useState(lead ? { leadId: lead.leadId, leadName: lead.leadName } : { leadId: '', leadName: '' });
  const [type, setType] = useState('Call');
  const [visitNumber, setVisitNumber] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const isVisit = type === 'Visit';

  async function handleSave() {
    setError('');
    if (!contact.leadId) { setError('Please select a contact first!'); return; }
    if (!date) { setError('Please select a date'); return; }

    setSaving(true);
    const res = await addFollowUp(
      {
        leadId: contact.leadId,
        leadName: contact.leadName,
        followUpDate: date,
        followUpTime: time,
        type,
        visitNumber,
        location,
        notes,
      },
      currentUser
    );
    setSaving(false);

    if (!res.success) { setError(res.message || 'Could not schedule follow-up'); return; }

    onScheduled?.(res.data);
    resetAndClose();
  }

  function resetAndClose() {
    setContact(lead ? { leadId: lead.leadId, leadName: lead.leadName } : { leadId: '', leadName: '' });
    setType('Call'); setVisitNumber(''); setDate(''); setTime('');
    setLocation(''); setNotes(''); setError('');
    onClose();
  }

  return (
    <div
      className="sfm-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) resetAndClose(); }}
    >
      <div className="sfm-box">
        {/* Header */}
        <div className="sfm-header">
          <span className="sfm-title">Schedule Follow-up / Visit</span>
          <button onClick={resetAndClose} className="sfm-close-btn">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="sfm-body">
          <Field label="Contact *">
            <ContactSearchSelect value={contact} onChange={setContact} locked={!!lead} />
          </Field>

          <div className="sfm-row">
            <Field label="Type *">
              <select className="sm-input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="Call">Call Follow-up</option>
                <option value="Visit">Field Visit</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Meeting">Meeting</option>
                <option value="Demo">Demo</option>
              </select>
            </Field>
            {isVisit && (
              <Field label="Visit Number (if Visit)">
                <select className="sm-input" value={visitNumber} onChange={(e) => setVisitNumber(e.target.value)}>
                  <option value="">N/A</option>
                  <option value="1st">1st Visit</option>
                  <option value="2nd">2nd Visit</option>
                  <option value="3rd">3rd Visit</option>
                  <option value="4th+">4th+ Visit</option>
                </select>
              </Field>
            )}
          </div>

          <div className="sfm-row">
            <Field label="Date *">
              <input type="date" className="sm-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Time">
              <input type="time" className="sm-input" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>

          {isVisit && (
            <Field label="Location (for Visit)">
              <input
                type="text"
                className="sm-input"
                placeholder="Client office, area etc."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
          )}

          <Field label="Notes">
            <textarea
              className="sm-input sfm-textarea"
              placeholder="Purpose of follow-up / agenda..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          {error && <div className="sfm-error">{error}</div>}

          <div className="sfm-footer">
            <button className="sm-btn sm-btn-ghost" onClick={resetAndClose}>Cancel</button>
            <button className="sm-btn sm-btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="sfm-field-label">{label}</label>
      {children}
    </div>
  );
}
