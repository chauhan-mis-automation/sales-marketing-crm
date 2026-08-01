import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSMAuth } from '../context/SMAuthContext'
import casilicaLogo from '../assets/casilica-logo.jpeg'
import './SMLogin.css'

export default function SMLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { smLogin } = useSMAuth()

  useEffect(() => {
    const remember = localStorage.getItem('sm_remember')
    if (remember === 'true') {
      setEmail(localStorage.getItem('sm_email') || '')
      setPassword(localStorage.getItem('sm_password') || '')
      setRememberMe(true)
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)

    const { data, error: dbError } = await supabase
      .from('sm_users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('password', password.trim())
      .single()

    setLoading(false)

    if (dbError || !data) {
      setError('Invalid email or password.')
      return
    }

    if (data.status !== 'Active') {
      setError('Account is inactive. Contact administrator.')
      return
    }

    if (rememberMe) {
      localStorage.setItem('sm_email', email.trim())
      localStorage.setItem('sm_password', password.trim())
      localStorage.setItem('sm_remember', 'true')
    } else {
      localStorage.removeItem('sm_email')
      localStorage.removeItem('sm_password')
      localStorage.setItem('sm_remember', 'false')
    }

    smLogin({
      userId: data.user_id,
      name: data.name,
      email: data.email,
      role: data.role,
      designation: data.designation,
    })

    navigate('/sales-marketing')
  }

  return (
    <div className="sml-page">
      <div className="sml-box">
        <div className="sml-brand">
          <div className="sml-logo">
            <img src={casilicaLogo} alt="Casilica" />
          </div>
          <div>
            <div className="sml-brand-name">Sales and Marketing CRM</div>
            <div className="sml-brand-tag">VISITING CARD TO DEAL CLOSE</div>
          </div>
        </div>

        <div className="sml-heading">Welcome back</div>
        <div className="sml-sub">Sign in to manage your pipeline</div>

        {error && <div className="sml-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="sml-field">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="sml-field">
            <label>Password</label>
            <div className="sml-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <i
                className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} sml-toggle-eye`}
                onClick={() => setShowPassword(!showPassword)}
              ></i>
            </div>
          </div>

          <div className="sml-remember">
            <input
              type="checkbox"
              id="smRememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="smRememberMe">Remember Me</label>
          </div>

          <button type="submit" className="sml-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
