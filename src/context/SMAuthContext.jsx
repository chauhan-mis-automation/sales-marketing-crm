import { createContext, useContext, useState } from 'react'

const SMAuthContext = createContext(null)

export function SMAuthProvider({ children }) {
  const [smUser, setSmUser] = useState(() => {
    const stored = localStorage.getItem('sm_crm_user')
    return stored ? JSON.parse(stored) : null
  })

  function smLogin(userData) {
    localStorage.setItem('sm_crm_user', JSON.stringify(userData))
    setSmUser(userData)
  }

  function smLogout() {
    localStorage.removeItem('sm_crm_user')
    setSmUser(null)
  }

  return (
    <SMAuthContext.Provider value={{ smUser, smLogin, smLogout }}>
      {children}
    </SMAuthContext.Provider>
  )
}

export function useSMAuth() {
  return useContext(SMAuthContext)
}
