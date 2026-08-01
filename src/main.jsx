import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import { SMAuthProvider } from './context/SMAuthContext'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SMAuthProvider>
        <App />
      </SMAuthProvider>
    </AuthProvider>
  </StrictMode>,
)