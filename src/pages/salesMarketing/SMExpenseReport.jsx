import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useSMAuth } from '../../context/SMAuthContext'
import './SMExpenseReport.css'

const EXPENSE_CATEGORIES = ['Food', 'Lodging', 'Auto', 'Rapido', 'Cab', 'Bus', 'Flight', 'Personal Vehicle', 'Others']

function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(n) {
  if (!n) return '—'
  if (n >= 1000) return `Rs.${(n / 1000).toFixed(1)}K`
  return `Rs.${Math.round(n)}`
}

function truncate(s, n) {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

export default function SMExpenseReport() {
  const { smUser } = useSMAuth()
  const isAdmin = smUser?.role === 'Admin'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [salesTeam, setSalesTeam] = useState([])
  const [payments, setPayments] = useState([])

  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState(isAdmin ? 'This Month' : 'All Time')
  const [typeFilter, setTypeFilter] = useState('')
  const [userFilter, setUserFilter] = useState(isAdmin ? '' : smUser?.name)

  const [bikeRate, setBikeRate] = useState('')
  const [carRate, setCarRate] = useState('')
  const [savingRates, setSavingRates] = useState(false)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: claims }, { data: rates }, { data: users }, { data: pay }] = await Promise.all([
      supabase.from('sm_expense_claims').select('*'),
      supabase.from('sm_travel_rates').select('*'),
      supabase.from('sm_users').select('name, role, user_id').in('role', ['Sales', 'Marketing']).eq('status', 'Active'),
      supabase.from('sm_expense_payments').select('*'),
    ])

    setSalesTeam(users || [])
    setPayments(pay || [])
    ;(rates || []).forEach(r => {
      if (r.vehicle_type === 'Bike') setBikeRate(r.rate_per_km)
      if (r.vehicle_type === 'Car') setCarRate(r.rate_per_km)
    })

    const interactionIds = [...new Set((claims || []).map(c => c.interaction_id).filter(Boolean))]
    let interactions = []
    let leadMap = {}
    if (interactionIds.length > 0) {
      const { data: intRows } = await supabase.from('sm_interactions').select('*').in('interaction_id', interactionIds)
      interactions = intRows || []
      const leadIds = [...new Set(interactions.map(i => i.lead_id).filter(Boolean))]
      if (leadIds.length > 0) {
        const { data: leadRows } = await supabase.from('sm_leads').select('lead_id, company').in('lead_id', leadIds)
        ;(leadRows || []).forEach(l => { leadMap[l.lead_id] = l })
      }
    }
    const intMap = {}
    interactions.forEach(i => { intMap[i.interaction_id] = i })

    // Group claims by interaction -> one report row per interaction
    const grouped = {}
    ;(claims || []).forEach(c => {
      const key = c.interaction_id || `standalone-${c.id}`
      if (!grouped[key]) {
        const int = intMap[c.interaction_id]
        grouped[key] = {
          key,
          date: int?.created_date || c.created_date,
          company: int ? (leadMap[int.lead_id]?.company || '') : '',
          location: int?.reached_location || '',
          description: int?.notes || '',
          salesPerson: c.sales_person,
          salesPersonId: c.sales_person_id,
          categories: {},
          receipts: [],
          total: 0,
        }
      }
      grouped[key].categories[c.category] = (grouped[key].categories[c.category] || 0) + Number(c.amount || 0)
      grouped[key].total += Number(c.amount || 0)
      if (c.receipt_url) grouped[key].receipts.push({ url: c.receipt_url, category: c.category })
    })

    setRows(Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date)))
    setLoading(false)
  }

  async function handleSaveRates() {
    setSavingRates(true)
    try {
      await supabase.from('sm_travel_rates').upsert({ vehicle_type: 'Bike', rate_per_km: parseFloat(bikeRate) || 0, updated_by: smUser?.name, updated_at: new Date().toISOString() }, { onConflict: 'vehicle_type' })
      await supabase.from('sm_travel_rates').upsert({ vehicle_type: 'Car', rate_per_km: parseFloat(carRate) || 0, updated_by: smUser?.name, updated_at: new Date().toISOString() }, { onConflict: 'vehicle_type' })
      alert('Vehicle rates saved!')
    } catch (err) {
      alert('Error saving rates: ' + err.message)
    } finally {
      setSavingRates(false)
    }
  }

  const period = useMemo(() => {
    const now = new Date()
    if (periodFilter === 'This Week') {
      const day = now.getDay()
      const start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0, 0, 0, 0)
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999)
      return { range: [start, end] }
    }
    if (periodFilter === 'This Month') return { month: now.getMonth(), year: now.getFullYear() }
    if (periodFilter === 'Last Month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return { month: d.getMonth(), year: d.getFullYear() }
    }
    if (periodFilter === 'This Quarter') {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3
      const start = new Date(now.getFullYear(), qStartMonth, 1)
      const end = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59, 999)
      return { range: [start, end] }
    }
    if (periodFilter === 'This Year') {
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
      return { range: [start, end] }
    }
    return null
  }, [periodFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (userFilter && r.salesPerson !== userFilter) return false
      if (companyFilter && r.company !== companyFilter) return false
      if (typeFilter && !(r.categories[typeFilter] > 0)) return false
      if (fromDate && r.date && r.date.slice(0, 10) < fromDate) return false
      if (toDate && r.date && r.date.slice(0, 10) > toDate) return false
      if (period) {
        const d = new Date(r.date)
        if (period.range) {
          if (d < period.range[0] || d > period.range[1]) return false
        } else if (d.getMonth() !== period.month || d.getFullYear() !== period.year) {
          return false
        }
      }
      if (!q) return true
      return (r.company || '').toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
    })
  }, [rows, search, userFilter, companyFilter, typeFilter, fromDate, toDate, period])

  const companies = useMemo(() => [...new Set(rows.map(r => r.company).filter(Boolean))].sort(), [rows])

  const categoryTotals = useMemo(() => {
    const t = {}
    EXPENSE_CATEGORIES.forEach(c => { t[c] = 0 })
    filtered.forEach(r => { EXPENSE_CATEGORIES.forEach(c => { t[c] += r.categories[c] || 0 }) })
    return t
  }, [filtered])

  const grandTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0)

  function resetAll() {
    setSearch(''); setFromDate(''); setToDate(''); setCompanyFilter('')
    setPeriodFilter(isAdmin ? 'This Month' : 'All Time'); setTypeFilter('')
    if (isAdmin) setUserFilter('')
  }

  // ── Payment status (only meaningful for a specific month + specific person) ──
  const paymentRecord = useMemo(() => {
    if (!period || period.range || !userFilter) return null
    const person = salesTeam.find(u => u.name === userFilter) || (userFilter === smUser?.name ? { user_id: smUser?.userId } : null)
    const personId = person?.user_id
    if (!personId) return null
    return payments.find(p => p.sales_person_id === personId && p.period_month === period.month && p.period_year === period.year) || null
  }, [payments, period, userFilter, salesTeam, smUser])

  async function setPaymentStatus(status) {
    if (!period || period.range || !userFilter) return
    const person = salesTeam.find(u => u.name === userFilter)
    const personId = person?.user_id || smUser?.userId
    try {
      await supabase.from('sm_expense_payments').upsert({
        sales_person: userFilter,
        sales_person_id: personId,
        period_month: period.month,
        period_year: period.year,
        status,
        paid_by: smUser?.name,
        paid_date: status === 'Paid' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'sales_person_id,period_month,period_year' })
      loadData()
    } catch (err) {
      alert('Error updating payment status: ' + err.message)
    }
  }

  const pageTitle = isAdmin ? 'Expense Report' : 'My Expense Report'

  return (
    <div>
      <h1 className="exr-title">{pageTitle} <span className="exr-count">({filtered.length} entries)</span></h1>

      {isAdmin && (
        <div className="exr-rates-box">
          <span className="exr-rates-label">Vehicle Rate Settings (Rs./KM)</span>
          <div className="exr-rate-field">
            <span>🏍️ Bike:</span>
            <input type="number" value={bikeRate} onChange={e => setBikeRate(e.target.value)} />
          </div>
          <div className="exr-rate-field">
            <span>🚗 Car:</span>
            <input type="number" value={carRate} onChange={e => setCarRate(e.target.value)} />
          </div>
          <button className="exr-save-rates-btn" onClick={handleSaveRates} disabled={savingRates}>
            <i className="fas fa-save"></i> {savingRates ? 'Saving…' : 'Save Rates'}
          </button>
        </div>
      )}

      <div className="exr-filters">
        <div className="exr-search">
          <i className="fas fa-search"></i>
          <input placeholder="Search company, location, notes…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
          <option value="All Time">All Time</option>
          <option value="This Week">This Week</option>
          <option value="This Month">This Month</option>
          <option value="Last Month">Last Month</option>
          <option value="This Quarter">This Quarter</option>
          <option value="This Year">This Year</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Expense Types</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {isAdmin && (
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)}>
            <option value="">All Users</option>
            {salesTeam.map(u => <option key={u.user_id} value={u.name}>{u.name}</option>)}
          </select>
        )}
        <button className="exr-reset-btn" onClick={resetAll}>Reset All</button>
      </div>

      {period && !period.range && userFilter && (
        <div className={`exr-payment-box ${paymentRecord?.status === 'Paid' ? 'paid' : 'unpaid'}`}>
          <div>
            <span className="exr-payment-label">Payment Status</span>
            <div className="exr-payment-sub">{periodFilter} — {userFilter}</div>
          </div>
          {isAdmin ? (
            <div className="exr-payment-btns">
              <button className={`exr-pay-btn unpaid ${paymentRecord?.status !== 'Paid' ? 'active' : ''}`} onClick={() => setPaymentStatus('Unpaid')}>
                <i className="fas fa-times"></i> Unpaid
              </button>
              <button className={`exr-pay-btn paid ${paymentRecord?.status === 'Paid' ? 'active' : ''}`} onClick={() => setPaymentStatus('Paid')}>
                <i className="fas fa-check"></i> Paid
              </button>
            </div>
          ) : (
            <span className={`exr-status-pill ${paymentRecord?.status === 'Paid' ? 'paid' : 'unpaid'}`}>
              <i className={`fas ${paymentRecord?.status === 'Paid' ? 'fa-check-circle' : 'fa-clock'}`}></i>
              {paymentRecord?.status === 'Paid' ? 'Paid' : 'Unpaid'}
            </span>
          )}
        </div>
      )}

      <div className="exr-card">
        <div className="exr-table-wrap">
          <table className="exr-table">
            <thead>
              <tr>
                <th>Date</th><th>Company</th><th>Location</th><th>Description</th>
                {isAdmin && <th>Sales Person</th>}
                {EXPENSE_CATEGORIES.map(c => <th key={c}>{c}</th>)}
                <th>Receipts</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={15} className="exr-empty"><i className="fas fa-spinner fa-spin"></i> Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={15} className="exr-empty">No expense entries found</td></tr>
              ) : filtered.map(r => (
                <tr key={r.key}>
                  <td className="exr-mono">{fmtDate(r.date)}</td>
                  <td><strong>{r.company || '—'}</strong></td>
                  <td className="exr-truncate">{truncate(r.location, 22)}</td>
                  <td className="exr-truncate">{truncate(r.description, 30)}</td>
                  {isAdmin && <td>{r.salesPerson}</td>}
                  {EXPENSE_CATEGORIES.map(c => (
                    <td key={c} className="exr-mono">{fmtMoney(r.categories[c])}</td>
                  ))}
                  <td>
                    {r.receipts.length === 0 ? '—' : (
                      <div className="exr-receipts">
                        {r.receipts.map((rec, i) => (
                          <a key={i} href={rec.url} target="_blank" rel="noreferrer" title={rec.category} className="exr-receipt-icon">
                            <i className="fas fa-paperclip"></i>
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="exr-row-total">{fmtMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="exr-card">
        <div className="exr-summary-title">Summary Totals</div>
        <div className="exr-summary-grid">
          {EXPENSE_CATEGORIES.map(c => (
            <div key={c} className="exr-summary-card">
              <div className="exr-summary-amount">{fmtMoney(categoryTotals[c])}</div>
              <div className="exr-summary-label">{c.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="exr-grand-total">
        <span>Grand Total</span>
        <span className="exr-grand-amount">{fmtMoney(grandTotal)}</span>
      </div>
    </div>
  )
}
