import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useSMAuth } from '../../context/SMAuthContext'
import { getMarketingKPIData, MARKETING_KRAS, effectiveTargetWeight, calcMetricPct, calcMarketingFinalScore } from '../../lib/marketingKpiCalc'
import MonthYearPicker from '../../components/MonthYearPicker'
import SetMarketingTargetModal from '../../components/SetMarketingTargetModal'
import ViewMarketingTargetsModal from '../../components/ViewMarketingTargetsModal'
import './SMMarketingKPIReport.css'

const TIMELINE_COLORS = { Monthly: '#4a5c40', Quarterly: '#b8860b', Daily: '#2d7a47' }

export default function SMMarketingKPIReport() {
  const { smUser } = useSMAuth()
  const isAdmin = smUser?.role === 'Admin' || smUser?.role === 'BackOffice'
  const now = new Date()

  const [marketingTeam, setMarketingTeam] = useState([])
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
    loadMarketingTeam()
  }, [])

  async function loadMarketingTeam() {
    const { data } = await supabase.from('sm_users').select('name, role, user_id').eq('role', 'Marketing').eq('status', 'Active').order('name')
    setMarketingTeam(data || [])
  }

  async function handleLoadReport() {
    setLoading(true)
    try {
      let name = smUser?.name
      let id = personId
      if (personId === 'ALL') {
        name = 'ALL'
      } else {
        const person = marketingTeam.find(p => p.user_id === personId)
        name = person?.name || smUser?.name
      }

      const kpiData = await getMarketingKPIData({ userID: id, name, role: 'Marketing' }, month, year)
      setKpi(kpiData)

      let targetRow = {}
      if (personId !== 'ALL') {
        const { data } = await supabase
          .from('sm_marketing_targets')
          .select('*')
          .eq('marketing_person_id', personId)
          .eq('month', month)
          .eq('year', year)
          .maybeSingle()
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

  const finalScore = kpi ? calcMarketingFinalScore(kpi, targets) : 0
  const finalColor = finalScore >= 80 ? '#2d7a47' : finalScore >= 50 ? '#b8860b' : '#be123c'

  const pageTitle = smUser?.role === 'Marketing' ? 'My KPI' : 'Marketing KPI & Reports'

  return (
    <div className="fade-in">
      <div className="mkr-header">
        <div>
          <h1 className="mkr-title">{pageTitle}</h1>
          <div className="mkr-subtitle">Marketing Engineer Performance Scorecard</div>
        </div>
        {isAdmin && (
          <div className="mkr-header-actions">
            <button className="mkr-btn-secondary" onClick={() => setShowViewTargets(true)}>
              <i className="fas fa-file-alt"></i> View Targets
            </button>
            <button className="mkr-btn-primary" onClick={() => setShowSetTarget(true)}>
              <i className="fas fa-bullseye"></i> Set / Edit Target
            </button>
          </div>
        )}
      </div>

      <div className="mkr-filters">
        {isAdmin ? (
          <select value={personId} onChange={e => setPersonId(e.target.value)}>
            <option value="ALL">All Marketing Persons</option>
            {marketingTeam.map(p => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
          </select>
        ) : (
          <select value={personId} disabled>
            <option value={smUser?.userId}>{smUser?.name} (Me)</option>
          </select>
        )}
        <MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
        <button className="mkr-load-btn" onClick={handleLoadReport} disabled={loading}>
          {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt"></i>} Load Report
        </button>
      </div>

      <div className="mkr-final-score">
        <div>
          <div className="mkr-final-label">Marketing Engineer KPI</div>
          <div className="mkr-final-sub">{loaded ? `${MONTH_LABEL(month)} ${year}` : 'Load report to see score'}</div>
        </div>
        <div className="mkr-final-value" style={{ color: finalColor }}>{finalScore} <span>/ 100</span></div>
      </div>

      <div className="mkr-kra-grid">
        {MARKETING_KRAS.map(kra => {
          const achieved = kpi ? kpi[kra.key] : 0
          const { target, weight } = effectiveTargetWeight(targets, kra)
          const pct = calcMetricPct(achieved, target)
          const barColor = pct >= 100 ? '#2d7a47' : pct >= 60 ? '#b8860b' : '#be123c'
          const timelineColor = TIMELINE_COLORS[kra.timeline] || '#4a5c40'
          const score = target > 0 ? Math.min(weight, parseFloat(((achieved / target) * weight).toFixed(1))) : 0

          return (
            <div className="mkr-kra-card" key={kra.key} style={{ borderTopColor: barColor }}>
              <div className="mkr-kra-top">
                <div className="mkr-kra-icon" style={{ background: `${barColor}20`, color: barColor }}>
                  <i className={`fas ${kra.icon}`}></i>
                </div>
                <span className="mkr-kra-label">{kra.label}</span>
                <span className="mkr-kra-pct" style={{ background: `${barColor}20`, color: barColor }}>{pct}%</span>
              </div>

              <div className="mkr-kra-value">{loaded ? achieved : 0}{kra.unit === 'pct' ? '%' : ''}</div>

              <div className="mkr-kra-bar"><div className="mkr-kra-fill" style={{ width: `${pct}%`, background: barColor }}></div></div>

              <div className="mkr-kra-bottom">
                <span>Target: {target}{kra.unit === 'pct' ? '%' : ''}</span>
                <span className="mkr-kra-timeline-badge" style={{ background: `${timelineColor}18`, color: timelineColor }}>{kra.timeline}</span>
                <span className="mkr-kra-score" style={{ color: barColor }}>{score.toFixed(1)} <small>/ {weight} pts</small></span>
              </div>

              <div className="mkr-kra-weightage">
                <span>WEIGHTAGE</span>
                <div className="mkr-kra-weightage-bar"><div style={{ width: `${weight}%` }}></div></div>
                <span className="mkr-kra-weightage-pct">{weight}%</span>
              </div>
            </div>
          )
        })}
      </div>

      {showSetTarget && (
        <SetMarketingTargetModal marketingTeam={marketingTeam} onClose={() => setShowSetTarget(false)} onSaved={handleLoadReport} />
      )}
      {showViewTargets && (
        <ViewMarketingTargetsModal onClose={() => setShowViewTargets(false)} />
      )}
    </div>
  )
}

function MONTH_LABEL(m) {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return names[m]
}
