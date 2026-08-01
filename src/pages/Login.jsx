import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import casilicaLogo from '../assets/casilica-logo.jpeg'
import './Login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth() // ← YE NAYA HAI

  useEffect(() => {
    const remember = localStorage.getItem('crm_remember')
    if (remember === 'true') {
      setUsername(localStorage.getItem('crm_username') || '')
      setPassword(localStorage.getItem('crm_password') || '')
      setRememberMe(true)
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password.')
      return
    }

    setLoading(true)

    const { data, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.trim().toLowerCase())
      .eq('password', password.trim())
      .single()

    setLoading(false)

    if (dbError || !data) {
      setError('Invalid username or password.')
      return
    }

    if (!data.active) {
      setError('Account is inactive. Contact administrator.')
      return
    }

    if (rememberMe) {
      localStorage.setItem('crm_username', username.trim())
      localStorage.setItem('crm_password', password.trim())
      localStorage.setItem('crm_remember', 'true')
    } else {
      localStorage.removeItem('crm_username')
      localStorage.removeItem('crm_password')
      localStorage.setItem('crm_remember', 'false')
    }

    // ✅ Ab context ke through login karo (localStorage + React state dono update hoga)
    login({
      username: data.username,
      name: data.name,
      role: data.role,
      email: data.email
    })

    navigate('/dashboard')
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <img
            src={casilicaLogo}
            alt="Casilica CRM Logo"
          />
        </div>

        <div className="login-heading">Welcome back</div>
        <div className="login-sub">Sign in to access your dashboard</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label>Password</label>
            <div className="login-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <i
                className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} login-toggle-eye`}
                onClick={() => setShowPassword(!showPassword)}
              ></i>
            </div>
          </div>

          <div className="login-remember">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe">Remember Me</label>
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}