import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('crm_user')
    return stored ? JSON.parse(stored) : null
  })

  function login(userData) {
    localStorage.setItem('crm_user', JSON.stringify(userData))
    setUser(userData) // ← Ye state update React ko re-render trigger karega
  }

  function logout() {
    localStorage.removeItem('crm_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}