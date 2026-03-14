import { Outlet } from 'react-router-dom'
import { LogOut, Moon, Sun } from 'lucide-react'

import { AppNav } from '@/components/app/app-nav'
import { Button } from '@/components/ui/button'
import { optionalEnv } from '@/config/env'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDarkTheme = theme === 'dark'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex w-full flex-col gap-6 px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 xl:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 md:text-sm dark:text-slate-300">
                Manufacturing Suite
              </p>
              <h1 className="mt-2 break-words text-xl font-semibold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100">
                {optionalEnv.appName}
              </h1>
              <p className="mt-2 max-w-2xl text-xs text-slate-600 md:text-sm dark:text-slate-300">
                Command center for stock movement, production flow, and sales ledger visibility.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 md:justify-end">
              <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 md:text-right dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Signed in as</p>
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user?.email ?? 'Unknown user'}</p>
              </div>

              <Button
                className="shrink-0"
                variant="outline"
                size="icon-sm"
                onClick={toggleTheme}
                aria-label={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
                title={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {isDarkTheme ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>

              <Button className="shrink-0 gap-1.5" variant="outline" onClick={() => void signOut()}>
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <AppNav />

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
