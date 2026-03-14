import { type ReactNode, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { AuthContext, type AuthContextValue } from '@/context/auth-context-instance'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/main'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      // Validate persisted token with Auth API. If invalid/expired, drop local session.
      if (data.session) {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (!mounted) return

        if (userError || !userData.user) {
          await supabase.auth.signOut({ scope: 'local' })
          setSession(null)
          queryClient.clear()
          setLoading(false)
          return
        }
      }

      setSession(data.session)
      setLoading(false)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        queryClient.clear()
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signIn: async ({ email, password }) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          throw new Error(error.message)
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) {
          await supabase.auth.signOut({ scope: 'local' })
        }
        setSession(null)
        queryClient.clear()
      },
    }),
    [loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
