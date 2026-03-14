import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { env, optionalEnv } from '@/config/env'
import { useAuth } from '@/hooks/use-auth'

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
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
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
