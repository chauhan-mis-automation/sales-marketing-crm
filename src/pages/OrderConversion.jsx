import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { formatDateDisplay } from '../lib/dateHelpers'
import { useCountUp } from '../lib/useCountUp'
import './queues/QueuePages.css'
import './OrderConversion.css'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function StatCard({ icon, label, value, suffix = '', color, delay = 0 }) {
  const animated = useCountUp(value, 900)
  return (
    <div className="oc-stat-card" style={{ animationDelay: `${delay}ms`, borderTopColor: color }}>
      <div className="oc-stat-icon" style={{ background: `${color}18`, color }}>{icon}</div>
      <div className="oc-stat-value" style={{ color }}>
        {Number.isInteger(value) ? Math.round(animated) : animated.toFixed(1)}{suffix}
      </div>
      <div className="oc-stat-label">{label}</div>
    </div>
  )
}

export default function OrderConversion() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [quotationDates, setQuotationDates] = useState({}) // enquiry_id -> earliest shared_date
  const [wonDates, setWonDates] = useState({})              // enquiry_id -> won date
  const [enqMap, setEnqMap] = useState({})
  const [year, setYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState([])
  const [activeModal, setActiveModal] = useState(null)
  const [hoveredMonth, setHoveredMonth] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [{ data: qtRows }, { data: stageLogs }, { data: enqRows }] = await Promise.all([
        supabase.from('quotation_versions').select('enquiry_id, shared_date'),
        supabase.from('stage_logs').select('enquiry_id, date_entered').eq('stage_name', 'Won'),
        supabase.from('enquiries').select('enquiry_id, company_name, project_name, current_stage'),
      ])

      const eMap = {}
      ;(enqRows || []).forEach(e => { eMap[e.enquiry_id] = e })
      setEnqMap(eMap)

      const qtMap = {}
      ;(qtRows || []).forEach(r => {
        if (!r.shared_date) return
        const d = new Date(r.shared_date)
        if (!qtMap[r.enquiry_id] || d < new Date(qtMap[r.enquiry_id])) {
          qtMap[r.enquiry_id] = r.shared_date
        }
      })
      setQuotationDates(qtMap)

      const wMap = {}
      ;(stageLogs || []).forEach(r => {
        if (!r.date_entered) return
        const d = new Date(r.date_entered)
        if (!wMap[r.enquiry_id] || d < new Date(wMap[r.enquiry_id])) {
          wMap[r.enquiry_id] = r.date_entered
        }
      })
      setWonDates(wMap)

      const years = new Set([new Date().getFullYear()])
      Object.values(qtMap).forEach(d => years.add(new Date(d).getFullYear()))
      Object.values(wMap).forEach(d => years.add(new Date(d).getFullYear()))
      setAvailableYears([...years].sort((a, b) => b - a))
    } catch (err) {
      console.error('Error loading order conversion data:', err)
    } finally {
      setLoading(false)
    }
  }

  const monthData = useMemo(() => {
    const buckets = MONTH_NAMES.map((label, idx) => ({
      month: label,
      monthIndex: idx,
      quotations: 0,
      won: 0,
      quotationIds: [],
      wonIds: [],
    }))

    Object.entries(quotationDates).forEach(([enqId, dateStr]) => {
      const d = new Date(dateStr)
      if (d.getFullYear() !== year) return
      buckets[d.getMonth()].quotations++
      buckets[d.getMonth()].quotationIds.push(enqId)
    })

    Object.entries(wonDates).forEach(([enqId, dateStr]) => {
      const d = new Date(dateStr)
      if (d.getFullYear() !== year) return
      buckets[d.getMonth()].won++
      buckets[d.getMonth()].wonIds.push(enqId)
    })

    return buckets.map(b => ({
      ...b,
      conversion: b.quotations > 0 ? parseFloat(((b.won / b.quotations) * 100).toFixed(1)) : 0,
    }))
  }, [quotationDates, wonDates, year])

  const totalQuotations = monthData.reduce((s, m) => s + m.quotations, 0)
  const totalWon = monthData.reduce((s, m) => s + m.won, 0)
  const overallConversion = totalQuotations > 0 ? (totalWon / totalQuotations) * 100 : 0

  function openMonthDetail(bucket, type) {
    const ids = type === 'quotations' ? bucket.quotationIds : bucket.wonIds
    const records = ids.map(id => ({
      enquiryId: id,
      company: enqMap[id]?.company_name || '—',
      project: enqMap[id]?.project_name || '—',
      stage: enqMap[id]?.current_stage || '—',
      date: type === 'quotations' ? quotationDates[id] : wonDates[id],
    }))
    setActiveModal({
      title: `${bucket.month} ${year} — ${type === 'quotations' ? 'Quotations Sent' : 'Orders Won'} (${records.length})`,
      records,
    })
  }

  function shiftYear(delta) {
    setYear(y => y + delta)
  }

  if (loading) {
    return <div className="oc-loading"><i className="fas fa-spinner fa-spin"></i> Loading order conversion data…</div>
  }

  return (
    <div className="oc-wrap">
      <div className="oc-toolbar">
        <p className="oc-subtitle">Month-on-month quotations submitted vs orders won, with conversion ratio</p>

        <div className="oc-year-picker">
          <button className="oc-year-arrow" onClick={() => shiftYear(-1)}><i className="fas fa-chevron-left"></i></button>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="oc-year-select">
            {availableYears.includes(year) ? null : <option value={year}>{year}</option>}
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="oc-year-arrow" onClick={() => shiftYear(1)}><i className="fas fa-chevron-right"></i></button>
        </div>
      </div>

      <div className="oc-stats-grid">
        <StatCard icon="💰" label="Quotations Sent" value={totalQuotations} color="#0369a1" delay={0} />
        <StatCard icon="🏆" label="Orders Won" value={totalWon} color="#059669" delay={80} />
        <StatCard icon="📈" label="Conversion Rate" value={overallConversion} suffix="%" color="#b45309" delay={160} />
      </div>

      <div className="oc-card oc-chart-card">
        <div className="oc-card-header">
          <div className="oc-card-title">📊 Month on Month Conversions — {year}</div>
        </div>
        <div className="oc-chart-body">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={monthData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              onMouseMove={(state) => setHoveredMonth(state?.activeLabel ?? null)}
              onMouseLeave={() => setHoveredMonth(null)}
            >
              <defs>
                <linearGradient id="ocQtGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0369a1" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#0369a1" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="ocWonGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5ede6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6a8c6f' }} axisLine={{ stroke: '#d4e0d6' }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6a8c6f' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#b45309' }} axisLine={false} tickLine={false}
                domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip content={<OCTooltip />} cursor={{ fill: 'rgba(45,122,71,.06)' }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Bar
                yAxisId="left" dataKey="quotations" name="Quotations Submitted"
                fill="url(#ocQtGradient)" radius={[6, 6, 0, 0]} barSize={22}
                animationDuration={900} animationEasing="ease-out"
                onClick={(data) => data.quotations > 0 && openMonthDetail(data, 'quotations')}
                cursor="pointer"
              />
              <Bar
                yAxisId="left" dataKey="won" name="Orders Won"
                fill="url(#ocWonGradient)" radius={[6, 6, 0, 0]} barSize={22}
                animationDuration={900} animationEasing="ease-out" animationBegin={120}
                onClick={(data) => data.won > 0 && openMonthDetail(data, 'won')}
                cursor="pointer"
              />
              <Line
                yAxisId="right" type="monotone" dataKey="conversion" name="Conversion %"
                stroke="#b45309" strokeWidth={2.5} dot={{ r: 4, fill: '#b45309', strokeWidth: 0 }}
                activeDot={{ r: 6 }} animationDuration={1100} animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="oc-card">
        <div className="oc-card-header">
          <div className="oc-card-title">📋 Conversion Table <span className="oc-count-sm">({year})</span></div>
        </div>
        <div className="oc-table-wrap">
          <table className="oc-table">
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign: 'center' }}>Quotations Submitted</th>
                <th style={{ textAlign: 'center' }}>Orders Won</th>
                <th style={{ textAlign: 'center' }}>Conversion %</th>
              </tr>
            </thead>
            <tbody>
              {monthData.map((m, i) => {
                const barColor = m.conversion >= 30 ? '#059669' : m.conversion >= 10 ? '#b45309' : '#6a8c6f'
                return (
                  <tr key={m.month} className={hoveredMonth === m.month ? 'oc-row-hovered' : ''} style={{ animationDelay: `${i * 25}ms` }}>
                    <td className="oc-month-cell">{m.month}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`oc-num oc-num-blue ${m.quotations > 0 ? 'oc-clickable' : ''}`}
                        onClick={() => m.quotations > 0 && openMonthDetail(m, 'quotations')}
                      >{m.quotations}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`oc-num oc-num-green ${m.won > 0 ? 'oc-clickable' : ''}`}
                        onClick={() => m.won > 0 && openMonthDetail(m, 'won')}
                      >{m.won}</span>
                    </td>
                    <td>
                      <div className="oc-conv-cell">
                        <span className="oc-conv-pct" style={{ color: barColor }}>{m.conversion}%</span>
                        <div className="oc-conv-bar"><div className="oc-conv-bar-fill" style={{ width: `${Math.min(m.conversion * 2, 100)}%`, background: barColor }}></div></div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="oc-total-row">
                <td>📊 Total ({year})</td>
                <td style={{ textAlign: 'center' }} className="oc-num-blue">{totalQuotations}</td>
                <td style={{ textAlign: 'center' }} className="oc-num-green">{totalWon}</td>
                <td>
                  <span className="oc-conv-pct" style={{ color: overallConversion >= 30 ? '#059669' : overallConversion >= 10 ? '#b45309' : '#6a8c6f' }}>
                    {overallConversion.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {activeModal && (
        <div className="oc-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="oc-modal" onClick={e => e.stopPropagation()}>
            <div className="oc-modal-header">
              <span>{activeModal.title}</span>
              <button onClick={() => setActiveModal(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="oc-modal-body">
              {activeModal.records.length === 0 ? (
                <div className="oc-empty">No records found.</div>
              ) : (
                <table className="oc-table">
                  <thead>
                    <tr>
                      <th>Enquiry ID</th>
                      <th>Company</th>
                      <th>Project</th>
                      <th>Stage</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeModal.records.map((r, i) => (
                      <tr key={i} onClick={() => navigate(`/enquiries/${r.enquiryId}`)} style={{ cursor: 'pointer' }}>
                        <td><span className="qp-id">{r.enquiryId}</span></td>
                        <td>{r.company}</td>
                        <td>{r.project}</td>
                        <td>{r.stage}</td>
                        <td className="qp-mono">{formatDateDisplay(r.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OCTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const qt = payload.find(p => p.dataKey === 'quotations')?.value ?? 0
  const won = payload.find(p => p.dataKey === 'won')?.value ?? 0
  const conv = payload.find(p => p.dataKey === 'conversion')?.value ?? 0
  return (
    <div className="oc-tooltip">
      <div className="oc-tooltip-title">{label}</div>
      <div className="oc-tooltip-row"><span className="oc-tooltip-dot" style={{ background: '#0369a1' }}></span>Quotations: <strong>{qt}</strong></div>
      <div className="oc-tooltip-row"><span className="oc-tooltip-dot" style={{ background: '#059669' }}></span>Won: <strong>{won}</strong></div>
      <div className="oc-tooltip-row"><span className="oc-tooltip-dot" style={{ background: '#b45309' }}></span>Conversion: <strong>{conv}%</strong></div>
    </div>
  )
}
