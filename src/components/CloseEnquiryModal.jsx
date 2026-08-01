import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDropdownData } from '../lib/useDropdownData'
import { useAuth } from '../context/AuthContext'
import { calculateTotalCost } from '../lib/costCalculator'
import CostBreakdownBox from './CostBreakdownBox'
import Modal from './Modal'

export default function CloseEnquiryModal({ enquiry, onClose, onSaved }) {
  const { user } = useAuth()
  const { reasonOfLost } = useDropdownData()

  const [outcome, setOutcome] = useState('')
  const [orderValue, setOrderValue] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryPeriod, setDeliveryPeriod] = useState('')
  const [warrantyPeriod, setWarrantyPeriod] = useState('')
  const [packing, setPacking] = useState('')
  const [freight, setFreight] = useState('')
  const [insurance, setInsurance] = useState('')
  const [gst, setGst] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

  const costResult = calculateTotalCost({ baseValue: orderValue, packing, freight, insurance, gst })

  async function handleSave() {
    if (!outcome) {
      alert('Please select an outcome (Won / Lost)')
      return
    }
    if (outcome === 'Won' && !orderValue) {
      alert('Final Order Value is required for Won')
      return
    }
    if (outcome === 'Lost' && !lostReason) {
      alert('Please select a Reason of Lost')
      return
    }
    if (!remarks.trim()) {
      alert('Please add remarks / closure notes')
      return
    }

    setSaving(true)
    try {
      const updatePayload = {
        current_stage: outcome,
        status: outcome,
        closure_remarks: remarks.trim()
      }

      if (outcome === 'Won') {
        updatePayload.final_order_value = orderValue ? parseFloat(orderValue) : null
        updatePayload.payment_terms = paymentTerms.trim()
        updatePayload.delivery_period = deliveryPeriod.trim()
        updatePayload.warranty_period = warrantyPeriod.trim()
        updatePayload.packing = packing.trim()
        updatePayload.freight = freight.trim()
        updatePayload.insurance = insurance.trim()
        updatePayload.gst = gst.trim()
        updatePayload.total_cost = costResult.total
      } else {
        updatePayload.reason_of_lost = lostReason
      }

      const { error: updateError } = await supabase
        .from('enquiries')
        .update(updatePayload)
        .eq('enquiry_id', enquiry.enquiry_id)
      if (updateError) throw updateError

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: outcome,
        remarks: outcome === 'Lost' ? `${lostReason} — ${remarks.trim()}` : remarks.trim(),
        logged_by: user?.name || ''
      })

      onSaved()
      onClose()
    } catch (err) {
      alert('Error closing enquiry: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="🏁 Close Enquiry"
      onClose={onClose}
      width="600px"
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-check"></i> {saving ? 'Submitting…' : 'Submit'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>Outcome *</label>
        <select value={outcome} onChange={e => setOutcome(e.target.value)}>
          <option value="">-- Select Outcome --</option>
          <option value="Won">🏆 Mark as WON</option>
          <option value="Lost">❌ Mark as LOST</option>
        </select>
      </div>

      {outcome === 'Won' && (
        <>
          <div className="modal-grid-2">
            <div className="modal-form-group">
              <label>Final Order Value (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={orderValue}
                onChange={e => setOrderValue(e.target.value)}
                placeholder="e.g. 250000"
              />
            </div>
            <div className="modal-form-group">
              <label>Payment Terms (Manual)</label>
              <input
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                placeholder="e.g. 30% advance, 70% on delivery"
              />
            </div>
            <div className="modal-form-group">
              <label>Delivery Period</label>
              <input
                value={deliveryPeriod}
                onChange={e => setDeliveryPeriod(e.target.value)}
                placeholder="e.g. 6 weeks from PO"
              />
            </div>
            <div className="modal-form-group">
              <label>Warranty Period</label>
              <input
                value={warrantyPeriod}
                onChange={e => setWarrantyPeriod(e.target.value)}
                placeholder="e.g. 12 months on-site"
              />
            </div>
            <div className="modal-form-group">
              <label>Packing</label>
              <input
                value={packing}
                onChange={e => setPacking(e.target.value)}
                placeholder="e.g. 5% or 2000"
              />
            </div>
            <div className="modal-form-group">
              <label>Freight</label>
              <input
                value={freight}
                onChange={e => setFreight(e.target.value)}
                placeholder="e.g. 5% or 4500"
              />
            </div>
            <div className="modal-form-group">
              <label>Insurance</label>
              <input
                value={insurance}
                onChange={e => setInsurance(e.target.value)}
                placeholder="e.g. 5% or 1500"
              />
            </div>
            <div className="modal-form-group">
              <label>GST (%)</label>
              <input
                value={gst}
                onChange={e => setGst(e.target.value)}
                placeholder="e.g. 12%"
              />
            </div>
          </div>

          {orderValue && (
            <CostBreakdownBox
              packing={packing}
              freight={freight}
              insurance={insurance}
              gst={gst}
              result={costResult}
            />
          )}
        </>
      )}

      {outcome === 'Lost' && (
        <div className="modal-form-group">
          <label>Reason of Lost *</label>
          <select value={lostReason} onChange={e => setLostReason(e.target.value)}>
            <option value="">-- Select Reason --</option>
            {reasonOfLost.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      <div className="modal-form-group">
        <label>Remarks / Closure Notes *</label>
        <textarea
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Why won / why lost? Additional details..."
        />
      </div>
    </Modal>
  )
}