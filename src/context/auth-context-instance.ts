import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

type SignInParams = {
  email: string
  password: string
}

export type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (params: SignInParams) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
