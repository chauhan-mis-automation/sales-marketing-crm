import './SMDashboards.css'

export default function SMComingSoon({ title, icon }) {
  return (
    <div>
      <h1 className="smd-greeting">{title}</h1>
      <p className="smd-date">This module is coming soon</p>

      <div className="smd-blank-card">
        <i className={`fas ${icon || 'fa-tools'}`}></i>
        <p>{title}</p>
        <span>We're building this section next — check back soon.</span>
      </div>
    </div>
  )
}
