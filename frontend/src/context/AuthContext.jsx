import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/meta').then((r) => setMeta(r.data)).catch(() => {})
    if (!localStorage.getItem('cf_token')) {
      setLoading(false)
      return
    }
    api.get('/api/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('cf_token'))
      .finally(() => setLoading(false))
  }, [])

  const handleAuth = ({ token, user }) => {
    localStorage.setItem('cf_token', token)
    setUser(user)
    return user
  }

  const login = (email, password) => api.post('/api/auth/login', { email, password }).then((r) => handleAuth(r.data))
  const register = (data) => api.post('/api/auth/register', data).then((r) => handleAuth(r.data))
  const logout = () => {
    localStorage.removeItem('cf_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, meta, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
