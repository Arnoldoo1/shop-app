import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, authConfigured } from './supabase'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(authConfigured)

  useEffect(() => {
    if (!authConfigured) return undefined
    supabase.auth.getSession()
      .then(({ data }) => setUser(data.session ? data.session.user : null))
      .catch(() => {})
      .finally(() => setLoading(false))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? session.user : null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = async () => {
    if (!authConfigured) {
      alert('Google sign-in is not set up yet. Add the Supabase publishable key to frontend/.env and restart.')
      return
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }
  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
