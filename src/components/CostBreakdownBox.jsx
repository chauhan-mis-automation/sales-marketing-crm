function fmt(n) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export default function CostBreakdownBox({ packing, freight, insurance, gst, result }) {
  return (
    <div className="cost-breakdown-box">
      <div className="cost-breakdown-title">
        <i className="fas fa-coins"></i> Auto Calculated Total Cost
      </div>

      <div className="cost-row">
        <span>Base Value</span>
        <span>{fmt(result.base)}</span>
      </div>

      {packing && (
        <div className="cost-row muted">
          <span>+ Packing {String(packing).includes('%') ? `(${packing})` : ''}</span>
          <span>{fmt(result.packingAmt)}</span>
        </div>
      )}

      {freight && (
        <div className="cost-row muted">
          <span>+ Freight {String(freight).includes('%') ? `(${freight})` : ''}</span>
          <span>{fmt(result.freightAmt)}</span>
        </div>
      )}

      {insurance && (
        <div className="cost-row muted">
          <span>+ Insurance {String(insurance).includes('%') ? `(${insurance})` : ''}</span>
          <span>{fmt(result.insuranceAmt)}</span>
        </div>
      )}

      {gst && (
        <div className="cost-row muted">
          <span>+ GST {String(gst).includes('%') ? `(${gst})` : ''}</span>
          <span>{fmt(result.gstAmt)}</span>
        </div>
      )}

      <hr className="cost-divider" />

      <div className="cost-row total">
        <span>Total Cost</span>
        <span>{fmt(result.total)}</span>
      </div>
    </div>
  )
}