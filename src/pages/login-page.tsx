import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { env, optionalEnv } from '@/config/env'
import { useAuth } from '@/hooks/use-auth'
import { Eye, EyeOff } from 'lucide-react'

type LocationState = {
  from?: {
    pathname?: string
  }
}


export function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (error) {
      setError(null)
    }
  }, [email, password, error])

  if (!loading && user) {
    const state = location.state as LocationState | undefined
    const target = state?.from?.pathname && state.from.pathname !== '/login' ? state.from.pathname : '/'
    return <Navigate replace to={target} />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedEmail !== env.allowedLoginEmail) {
      setError('This application is restricted to the authorized account only.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await signIn({ email: normalizedEmail, password })
      const state = location.state as LocationState | undefined
      const target = state?.from?.pathname && state.from.pathname !== '/login' ? state.from.pathname : '/'
      navigate(target, { replace: true })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to login. Please try again.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-6 sm:py-10 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription className="break-words">{optionalEnv.appName}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-slate-500 dark:text-slate-400">Signup is disabled for this application.</p>
        </CardFooter>
      </Card>
    </div>
  )
}
