import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { sanitizeFileName } from '../lib/fileHelpers'
import { calculateTotalCost } from '../lib/costCalculator'
import CostBreakdownBox from './CostBreakdownBox'
import Modal from './Modal'

export default function PurchaseOrderModal({ enquiry, existingPOCount, isRevision, onClose, onSaved }) {
  const { user } = useAuth()

  const [orderValue, setOrderValue] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryPeriod, setDeliveryPeriod] = useState('')
  const [warrantyPeriod, setWarrantyPeriod] = useState('')
  const [packing, setPacking] = useState('')
  const [freight, setFreight] = useState('')
  const [insurance, setInsurance] = useState('')
  const [gst, setGst] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)

  const costResult = calculateTotalCost({ baseValue: orderValue, packing, freight, insurance, gst })

  function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (files.length === 0) {
      alert('Please upload at least one PO file')
      return
    }

    setSaving(true)
    try {
      let fileUrls = []
      for (const file of files) {
        const filePath = `purchase-orders/${enquiry.enquiry_id}/${Date.now()}_${sanitizeFileName(file.name)}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('enquiry-attachments')
          .upload(filePath, file)

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('enquiry-attachments')
            .getPublicUrl(filePath)
          fileUrls.push(urlData.publicUrl)
        }
      }

      const version = `V${(existingPOCount || 0) + 1}`
      const poId = `PO-${Date.now()}`

      const { error: insertError } = await supabase.from('purchase_orders').insert({
        po_id: poId,
        enquiry_id: enquiry.enquiry_id,
        version,
        file_url: fileUrls.join(', '),
        final_order_value: orderValue ? parseFloat(orderValue) : null,
        payment_terms: paymentTerms.trim(),
        delivery_period: deliveryPeriod.trim(),
        warranty_period: warrantyPeriod.trim(),
        packing: packing.trim(),
        freight: freight.trim(),
        insurance: insurance.trim(),
        gst: gst.trim(),
        total_cost: costResult.total,
        notes: notes.trim(),
        submitted_by: user?.name || '',
        status: 'Uploaded',
        revision_count: existingPOCount || 0
      })
      if (insertError) throw insertError

      await supabase.from('stage_logs').insert({
        log_id: `LOG-${Date.now()}`,
        enquiry_id: enquiry.enquiry_id,
        stage_name: isRevision ? 'PO Revised' : 'PO Uploaded',
        remarks: `PO ${version} uploaded${notes.trim() ? ' | ' + notes.trim() : ''}`,
        logged_by: user?.name || ''
      })

      // Admin/superadmin ko review ke liye notify karo
      const { data: adminUsers } = await supabase
        .from('users')
        .select('name')
        .in('role', ['admin', 'superadmin'])
        .eq('active', true)

      if (adminUsers && adminUsers.length > 0) {
        await supabase.from('notifications').insert(
          adminUsers.map(a => ({
            recipient_name: a.name,
            enquiry_id: enquiry.enquiry_id,
            title: '📄 New PO Uploaded — Review Required',
            message: `PO ${version} uploaded for enquiry ${enquiry.enquiry_id} by ${user?.name || ''}. Please review and approve/reject. 👤 Client: ${enquiry.company_name}`,
            type: 'po_review'
          }))
        )
      }

      onSaved()
      onClose()
    } catch (err) {
      alert('Error uploading PO: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="📄 Purchase Order"
      onClose={onClose}
      width="600px"
      footer={
        <>
          <button className="btn-modal-ghost" onClick={onClose}>Close</button>
          <button className="btn-modal-primary" onClick={handleSave} disabled={saving}>
            <i className="fas fa-paper-plane"></i> {saving ? 'Submitting…' : 'Submit to Admin'}
          </button>
        </>
      }
    >
      <div className="modal-form-group">
        <label>PO File(s) (PDF / Image) — Multiple Allowed *</label>
        <label className="modal-file-btn modal-file-btn-block">
          <i className="fas fa-paperclip"></i> Upload PO File(s)
          <input type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
        </label>
        <div className="modal-helper" style={{ marginTop: 6, marginBottom: 0 }}>
          Hold Ctrl / Cmd to select multiple files
        </div>
        {files.length > 0 && (
          <div className="modal-file-tags">
            {files.map((f, i) => (
              <div key={i} className="modal-file-tag">
                <span>{f.name}</span>
                <button type="button" onClick={() => removeFile(i)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="modal-grid-2">
        <div className="modal-form-group">
          <label>Final Order Value (₹)</label>
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
          <label>Payment Terms</label>
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
            placeholder="e.g. 8 weeks from PO date"
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
            placeholder="e.g. Wooden crate"
          />
        </div>
        <div className="modal-form-group">
          <label>Freight</label>
          <input
            value={freight}
            onChange={e => setFreight(e.target.value)}
            placeholder="e.g. Extra, paid by buyer"
          />
        </div>
        <div className="modal-form-group">
          <label>Insurance</label>
          <input
            value={insurance}
            onChange={e => setInsurance(e.target.value)}
            placeholder="e.g. Included, buyer's cost"
          />
        </div>
        <div className="modal-form-group">
          <label>GST (%)</label>
          <input
            value={gst}
            onChange={e => setGst(e.target.value)}
            placeholder="e.g. 18%"
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

      <div className="modal-form-group">
        <label>Remarks</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional remarks..."
        />
      </div>

      <div className="modal-info-banner">
        <i className="fas fa-info-circle"></i>
        <span>Admin / Superadmin will be notified to review this PO.</span>
      </div>
    </Modal>
  )
}
