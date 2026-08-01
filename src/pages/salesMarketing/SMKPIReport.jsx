import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useSMAuth } from '../../context/SMAuthContext'
import { getKPIData, KPI_METRICS, formatKPIValue, calcFinalScore, calcMetricPct } from '../../lib/kpiCalc'
import SetTargetModal from '../../components/SetTargetModal'
import ViewTargetsModal from '../../components/ViewTargetsModal'
import './SMKPIReport.css'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function SMKPIReport() {
  const { smUser } = useSMAuth()
  const isAdmin = smUser?.role === 'Admin'
  const now = new Date()

  const [salesTeam, setSalesTeam] = useState([])
  const [personId, setPersonId] = useState(isAdmin ? 'ALL' : smUser?.userId)
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  const [kpi, setKpi] = useState(null)
  const [targets, setTargets] = useState({})
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const [showSetTarget, setShowSetTarget] = useState(false)
  const [showViewTargets, setShowViewTargets] = useState(false)

  useEffect(() => {
    loadSalesTeam()
  }, [])

  async function loadSalesTeam() {
    const { data } = await supabase.from('sm_users').select('name, role, user_id').in('role', ['Sales', 'Marketing']).eq('status', 'Active').order('name')
    setSalesTeam(data || [])
  }

  async function handleLoadReport() {
    setLoading(true)
    try {
      let name = smUser?.name
      let id = personId
      if (personId === 'ALL') {
        name = 'ALL'
      } else {
        const person = salesTeam.find(p => p.user_id === personId)
        name = person?.name || smUser?.name
      }

      const kpiData = await getKPIData({ userID: id, name, role: smUser?.role }, month, year)
      setKpi(kpiData)

      let targetRow = {}
      if (personId !== 'ALL') {
        const { data } = await supabase.from('sm_targets').select('*').eq('sales_person_id', personId).eq('month', month).eq('year', year).maybeSingle()
        targetRow = data || {}
      }
      setTargets(targetRow)
      setLoaded(true)
    } catch (err) {
      alert('Error loading report: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const finalScore = kpi ? calcFinalScore(kpi, targets) : 0

  return (
    <div className="fade-in">
      <div className="kpr-header">
        <h1 className="kpr-title">KPI &amp; Reports</h1>
        {isAdmin && (
          <div className="kpr-header-actions">
            <button className="kpr-btn-secondary" onClick={() => setShowViewTargets(true)}>
              <i className="fas fa-file-alt"></i> View Targets
            </button>
            <button className="kpr-btn-primary" onClick={() => setShowSetTarget(true)}>
              <i className="fas fa-bullseye"></i> Set Target
            </button>
          </div>
        )}
      </div>

      <div className="kpr-filters">
        {isAdmin ? (
          <select value={personId} onChange={e => setPersonId(e.target.value)}>
            <option value="ALL">All Sales Persons</option>
            {salesTeam.map(p => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
          </select>
        ) : (
          <select value={personId} disabled>
            <option value={smUser?.userId}>{smUser?.name} (Me)</option>
          </select>
        )}
        <select value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="kpr-load-btn" onClick={handleLoadReport} disabled={loading}>
          {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt"></i>} Load Report
        </button>
      </div>

      <div className="kpr-final-score">
        <div>
          <div className="kpr-final-label">Final Score</div>
          <div className="kpr-final-sub">{loaded ? `${MONTH_NAMES[month]} ${year}` : 'Load report to see score'}</div>
        </div>
        <div className="kpr-final-value">{finalScore} <span>/ 100</span></div>
      </div>

      <div className="kpr-metric-grid">
        {KPI_METRICS.map(m => {
          const achieved = kpi ? kpi[m.key] : 0
          const target = targets?.[m.targetKey] || 0
          const pct = calcMetricPct(achieved, target)
          return (
            <div className="kpr-metric-card" key={m.key}>
              <div className="kpr-metric-top">
                <span className="kpr-metric-label">{m.label.toUpperCase()}</span>
                <span className="kpr-metric-pct">{pct}%</span>
              </div>
              <div className="kpr-metric-value">{loaded ? formatKPIValue(achieved, m.unit) : (m.unit === 'pct' ? '0%' : '0')}</div>
              <div className="kpr-metric-bar"><div className="kpr-metric-fill" style={{ width: `${pct}%` }}></div></div>
              <div className="kpr-metric-bottom">
                <span>Target: {target || 0}</span>
                <span>Achieved</span>
              </div>
            </div>
          )
        })}
      </div>

      {showSetTarget && (
        <SetTargetModal salesTeam={salesTeam} onClose={() => setShowSetTarget(false)} onSaved={handleLoadReport} />
      )}
      {showViewTargets && (
        <ViewTargetsModal onClose={() => setShowViewTargets(false)} />
      )}
    </div>
  )
}
