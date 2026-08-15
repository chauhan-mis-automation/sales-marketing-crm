import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useSMAuth } from '../context/SMAuthContext'
import { useSMDropdownData } from '../lib/useSMDropdownData'
import { sanitizeFileName } from '../lib/fileHelpers'
import { logActivity } from '../lib/activityLog'
import Modal from './Modal'
import './LogInteractionModal.css'

const INTERACTION_TYPES = ['Call', 'WhatsApp', 'Meeting', 'Visit', 'Email', 'Demo']
const VISIT_NUMBERS = ['1st', '2nd', '3rd', '4th+']
const EXPENSE_CATEGORIES = ['Food', 'Lodging', 'Auto', 'Rapido', 'Cab', 'Bus', 'Flight', 'Personal Vehicle', 'Others']

function genInteractionId() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `INT-${ts}${rand}`
}

function minutesBetween(a, b) {
  if (!a || !b) return null
  return Math.max(0, Math.floor((b - a) / 60000))
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
    const data = await res.json()
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

function fetchGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

export default function LogInteractionModal({ followUp, currentUser, onClose, onSaved }) {
  const { smUser } = useSMAuth()
  const { interactionType: interactionTypeOptions, response: responseOptions, loading: dropdownsLoading } = useSMDropdownData()

  const isVisit = (t) => t === 'Visit'

  const [type, setType] = useState(followUp.type || 'Call')
  const [visitNumber, setVisitNumber] = useState(followUp.visitNumber || '1st')
  const [lastVisit, setLastVisit] = useState(null) // { date, notes }
  const [clientResponse, setClientResponse] = useState('')
  const [manualResponse, setManualResponse] = useState('')
  const [notes, setNotes] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [nextTime, setNextTime] = useState('')
  const [nextType, setNextType] = useState('Call')
  const [claimExpense, setClaimExpense] = useState('No')
  const [expenseRows, setExpenseRows] = useState([{ category: 'Food', amount: '', vehicleType: 'Bike', distanceKm: '', receiptFile: null }])
  const [travelRates, setTravelRates] = useState({ Bike: 0, Car: 0 })

  // Visit meeting tracker
  const [trackerStep, setTrackerStep] = useState('idle') // idle -> reached -> started -> ended
  const [arrivalTime, setArrivalTime] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [endTime, setEndTime] = useState(null)
  const [reached, setReached] = useState({ status: 'idle', address: '', lat: null, lng: null })
  const [closeLoc, setCloseLoc] = useState({ status: 'idle', address: '', lat: null, lng: null })

  const [saving, setSaving] = useState(false)

  // For a non-visit interaction, the rest of the form is always visible.
  // For a Visit, the rest of the form only appears once the meeting is closed.
  const showRestOfForm = !isVisit(type) || trackerStep === 'ended'

  useEffect(() => {
    if (!isVisit(type)) return
    loadVisitContext()
    loadTravelRates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  async function loadVisitContext() {
    const { data } = await supabase
      .from('sm_interactions')
      .select('*')
      .eq('lead_id', followUp.leadID)
      .eq('type', 'Visit')
      .order('created_date', { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      const last = data[0]
      setLastVisit({ date: new Date(last.created_date).toLocaleDateString('en-GB'), notes: last.notes })
      const num = parseInt(last.visit_number) || 1
      const nextNum = num + 1
      setVisitNumber(nextNum >= 4 ? '4th+' : `${nextNum}${nextNum === 1 ? 'st' : nextNum === 2 ? 'nd' : 'rd'}`)
    } else {
      setLastVisit(null)
      setVisitNumber('1st')
    }
  }

  async function loadTravelRates() {
    const { data } = await supabase.from('sm_travel_rates').select('*')
    const rates = { Bike: 0, Car: 0 }
    ;(data || []).forEach(r => { rates[r.vehicle_type] = r.rate_per_km })
    setTravelRates(rates)
  }

  // ── Visit meeting tracker actions ──────────────────────
  async function handleReached() {
    const now = new Date()
    setArrivalTime(now)
    setTrackerStep('reached')
    setReached({ status: 'fetching', address: '', lat: null, lng: null })
    try {
      const { lat, lng } = await fetchGeolocation()
      const address = await reverseGeocode(lat, lng)
      setReached({ status: 'captured', address, lat, lng })
    } catch {
      setReached({ status: 'error', address: '', lat: null, lng: null })
    }
  }

  function handleStartMeeting() {
    setStartTime(new Date())
    setTrackerStep('started')
  }

  async function handleCloseMeeting() {
    const now = new Date()
    setEndTime(now)
    setTrackerStep('ended')
    setCloseLoc({ status: 'fetching', address: '', lat: null, lng: null })
    try {
      const { lat, lng } = await fetchGeolocation()
      const address = await reverseGeocode(lat, lng)
      setCloseLoc({ status: 'captured', address, lat, lng })
    } catch {
      setCloseLoc({ status: 'error', address: '', lat: null, lng: null })
    }
  }

  const waitMinutes = minutesBetween(arrivalTime, startTime)
  const durationMinutes = minutesBetween(startTime, endTime)

  // ── Expense rows ────────────────────────────────────────
  function updateExpenseRow(idx, patch) {
    setExpenseRows(rows => rows.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function addExpenseRow() {
    setExpenseRows(rows => [...rows, { category: 'Food', amount: '', vehicleType: 'Bike', distanceKm: '', receiptFile: null }])
  }

  function removeExpenseRow(idx) {
    setExpenseRows(rows => rows.filter((_, i) => i !== idx))
  }

  function vehicleAmount(row) {
    const km = parseFloat(row.distanceKm) || 0
    const rate = travelRates[row.vehicleType] || 0
    return (km * rate).toFixed(2)
  }

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    if (!notes.trim()) { alert('Please enter Notes / Discussion Details'); return }

    setSaving(true)
    try {
      const interactionId = genInteractionId()
      const finalResponse = clientResponse === 'Others' && manualResponse.trim() ? manualResponse.trim() : clientResponse

      const { error: intError } = await supabase.from('sm_interactions').insert({
        interaction_id: interactionId,
        lead_id: followUp.leadID,
        lead_name: followUp.leadName,
        sales_person: currentUser?.name || '',
        sales_person_id: currentUser?.userID || '',
        type,
        client_response: finalResponse,
        notes: notes.trim(),
        visit_number: isVisit(type) ? visitNumber : '',
        arrival_time: arrivalTime ? arrivalTime.toISOString() : null,
        meeting_start_time: startTime ? startTime.toISOString() : null,
        meeting_end_time: endTime ? endTime.toISOString() : null,
        wait_minutes: waitMinutes,
        duration_minutes: durationMinutes,
        reached_location: reached.address,
        reached_lat: reached.lat,
        reached_lng: reached.lng,
        close_location: closeLoc.address,
        close_lat: closeLoc.lat,
        close_lng: closeLoc.lng,
        next_followup_date: nextDate || null,
        next_followup_time: nextTime || null,
        next_followup_type: nextDate ? nextType : null,
        claim_expense: isVisit(type) && claimExpense === 'Yes',
      })

      if (intError) throw intError

      logActivity({
        userId: currentUser?.userID, userName: currentUser?.name, role: smUser?.role,
        leadId: followUp.leadID, leadName: followUp.leadName,
        action: isVisit(type) ? 'LOG_VISIT' : 'LOG_INTERACTION',
        module: 'Interactions',
        details: `${type} logged${finalResponse ? ' — ' + finalResponse : ''}`,
        location: isVisit(type) ? (reached.address || '') : '',
        latitude: isVisit(type) ? reached.lat : null,
        longitude: isVisit(type) ? reached.lng : null,
      })

      // Expense claims (Visit only, if claimed)
      if (isVisit(type) && claimExpense === 'Yes') {
        for (const row of expenseRows) {
          if (!row.category) continue
          let receiptUrl = ''
          if (row.receiptFile) {
            const filePath = `sm-receipts/${Date.now()}_${sanitizeFileName(row.receiptFile.name)}`
            const { error: upErr } = await supabase.storage.from('enquiry-attachments').upload(filePath, row.receiptFile)
            if (!upErr) {
              const { data: urlData } = supabase.storage.from('enquiry-attachments').getPublicUrl(filePath)
              receiptUrl = urlData.publicUrl
            }
          }
          const amount = row.category === 'Personal Vehicle' ? parseFloat(vehicleAmount(row)) : (parseFloat(row.amount) || 0)

          await supabase.from('sm_expense_claims').insert({
            interaction_id: interactionId,
            category: row.category,
            amount,
            vehicle_type: row.category === 'Personal Vehicle' ? row.vehicleType : '',
            distance_km: row.category === 'Personal Vehicle' ? (parseFloat(row.distanceKm) || 0) : null,
            receipt_url: receiptUrl,
            sales_person: currentUser?.name || '',
            sales_person_id: currentUser?.userID || '',
          })
        }
      }

      // Mark this follow-up Done
      await supabase.from('sm_followups').update({
        status: 'Done',
        notes: `[${finalResponse || 'Updated'}] ${notes.trim()}`,
        completed_date: new Date().toISOString(),
      }).eq('followup_id', followUp.followUpID)

      // Schedule the next follow-up, if given
      if (nextDate) {
        const ts = Date.now().toString(36).toUpperCase()
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
        await supabase.from('sm_followups').insert({
          followup_id: `FUP-${ts}${rand}`,
          lead_id: followUp.leadID,
          lead_name: followUp.leadName,
          sales_person: currentUser?.name || '',
          sales_person_id: currentUser?.userID || '',
          follow_up_date: nextDate,
          follow_up_time: nextTime || null,
          type: nextType,
          status: 'Pending',
          notes: `Follow-up from previous ${type.toLowerCase()}: ${notes.trim()}`,
        })
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error saving interaction: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const trackerStatusLabel = {
    idle: 'Ready to Reach',
    reached: 'At Location (Waiting)',
    started: 'Meeting in Progress',
    ended: 'Meeting Finished',
  }[trackerStep]

  return (
    <Modal
      title={isVisit(type) ? `📝 Log Interaction — ${visitNumber} Visit` : '📝 Log Interaction'}
      onClose={onClose}
      width={620}
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          {showRestOfForm && (
            <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
              <i className="fas fa-save"></i> {saving ? 'Saving…' : 'Save Interaction'}
            </button>
          )}
        </>
      }
    >
      <div className="modal-form-group">
        <label>Contact</label>
        <input value={followUp.leadName} disabled />
      </div>

      <div className="modal-form-group">
        <label>Interaction Type *</label>
        <select value={type} onChange={e => setType(e.target.value)}>
          {(interactionTypeOptions.length ? interactionTypeOptions : INTERACTION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {isVisit(type) && (
        <>
          <div className="modal-form-group">
            <label>Visit Number</label>
            <select value={visitNumber} onChange={e => setVisitNumber(e.target.value)}>
              {VISIT_NUMBERS.map(v => <option key={v} value={v}>{v} Visit</option>)}
            </select>
          </div>

          {lastVisit && (
            <div className="lim-last-visit">
              <strong>Last Visit: {lastVisit.date}</strong>
              <div className="lim-last-visit-notes">{lastVisit.notes}</div>
            </div>
          )}

          <div className="lim-tracker-box">
            <div className="lim-tracker-status">STATUS: {trackerStatusLabel.toUpperCase()}</div>
            <div className="lim-tracker-btns">
              <button
                className={`lim-tracker-btn ${trackerStep === 'idle' ? 'active' : ''}`}
                onClick={handleReached}
                disabled={trackerStep !== 'idle'}
              >
                <i className="fas fa-map-marker-alt"></i> Reached Location
              </button>
              <button
                className={`lim-tracker-btn ${trackerStep === 'reached' ? 'active' : ''}`}
                onClick={handleStartMeeting}
                disabled={trackerStep !== 'reached'}
              >
                <i className="fas fa-play"></i> Start Meeting
              </button>
              <button
                className={`lim-tracker-btn danger ${trackerStep === 'started' ? 'active' : ''}`}
                onClick={handleCloseMeeting}
                disabled={trackerStep !== 'started'}
              >
                <i className="fas fa-stop"></i> Close Meeting
              </button>
            </div>

            <div className="lim-tracker-times">
              Arrival: {arrivalTime ? arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'} |
              {' '}Wait: {waitMinutes !== null ? `${waitMinutes} mins` : '--'} |
              {' '}Duration: {durationMinutes !== null ? `${durationMinutes} mins` : '--'}
            </div>

            <div className="lim-location-row">
              <button className="lim-fetch-btn" onClick={handleReached} disabled={trackerStep !== 'idle'}>
                <i className="fas fa-map-marker-alt"></i> Fetch Reached Location
              </button>
              {reached.status === 'captured' && <span className="lim-captured"><i className="fas fa-check"></i> Location captured</span>}
              {reached.status === 'fetching' && <span className="lim-fetching">Fetching…</span>}
              {reached.status === 'idle' && <span className="lim-not-fetched">Not fetched</span>}
            </div>
            {reached.address && <div className="lim-address-box"><i className="fas fa-map-marker-alt"></i> {reached.address}</div>}

            <div className="lim-location-row">
              <button className="lim-fetch-btn" onClick={handleCloseMeeting} disabled={trackerStep !== 'started' && trackerStep !== 'ended'}>
                <i className="fas fa-flag-checkered"></i> Fetch Close Location
              </button>
              {closeLoc.status === 'captured' && <span className="lim-captured"><i className="fas fa-check"></i> Close location captured</span>}
              {closeLoc.status === 'fetching' && <span className="lim-fetching">Fetching…</span>}
              {closeLoc.status === 'idle' && <span className="lim-not-fetched">Not fetched</span>}
            </div>
            {closeLoc.address && <div className="lim-address-box"><i className="fas fa-flag-checkered"></i> {closeLoc.address}</div>}
          </div>
        </>
      )}

      {showRestOfForm && (
        <>
          <div className="modal-form-group">
            <label>Client Response</label>
            <select value={clientResponse} onChange={e => setClientResponse(e.target.value)} disabled={dropdownsLoading}>
              <option value="">-- Select Response --</option>
              {responseOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {clientResponse === 'Others' && (
            <div className="modal-form-group">
              <input
                value={manualResponse}
                onChange={e => setManualResponse(e.target.value.slice(0, 20))}
                placeholder="Type manual response…"
                maxLength={20}
              />
              <div className="lim-char-count">{manualResponse.length}/20</div>
            </div>
          )}

          <div className="modal-form-group">
            <label>Notes / Discussion Details *</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={isVisit(type) ? 'What was discussed in this visit?' : 'What was discussed?'} />
          </div>

          <div className="modal-form-row">
            <div className="modal-form-group">
              <label>Next Follow-up Date</label>
              <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} />
            </div>
            <div className="modal-form-group">
              <label>Next Follow-up Time</label>
              <input type="time" value={nextTime} onChange={e => setNextTime(e.target.value)} />
            </div>
          </div>

          <div className="modal-form-group">
            <label>Next Follow-up Type</label>
            <select value={nextType} onChange={e => setNextType(e.target.value)}>
              {(interactionTypeOptions.length ? interactionTypeOptions : INTERACTION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {isVisit(type) && (
            <>
              <div className="modal-form-group">
                <label>Claim Expense?</label>
                <select value={claimExpense} onChange={e => setClaimExpense(e.target.value)}>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {claimExpense === 'Yes' && (
                <div className="lim-expense-box">
                  <label className="lim-expense-title">Expense Details</label>
                  {expenseRows.map((row, idx) => (
                    <div key={idx} className="lim-expense-row">
                      <div className="lim-expense-row-top">
                        <select value={row.category} onChange={e => updateExpenseRow(idx, { category: e.target.value })}>
                          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {row.category === 'Personal Vehicle' ? (
                          <input value={vehicleAmount(row)} disabled placeholder="Auto-calculated" />
                        ) : (
                          <input type="number" value={row.amount} onChange={e => updateExpenseRow(idx, { amount: e.target.value })} placeholder="Amount (Rs.)" />
                        )}
                        <button type="button" className="lim-row-btn" onClick={addExpenseRow} title="Add another expense">+</button>
                        {expenseRows.length > 1 && (
                          <button type="button" className="lim-row-btn danger" onClick={() => removeExpenseRow(idx)} title="Remove">−</button>
                        )}
                      </div>

                      {row.category === 'Personal Vehicle' && (
                        <div className="lim-vehicle-row">
                          <select value={row.vehicleType} onChange={e => updateExpenseRow(idx, { vehicleType: e.target.value })}>
                            <option value="Bike">🏍️ Bike</option>
                            <option value="Car">🚗 Car</option>
                          </select>
                          <input type="number" value={row.distanceKm} onChange={e => updateExpenseRow(idx, { distanceKm: e.target.value })} placeholder="Distance (KM)" />
                        </div>
                      )}

                      <div className="lim-receipt-row">
                        <input type="file" accept="image/*,.pdf" onChange={e => updateExpenseRow(idx, { receiptFile: e.target.files?.[0] || null })} />
                        <span>{row.receiptFile ? row.receiptFile.name : 'No receipt attached'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  )
}
