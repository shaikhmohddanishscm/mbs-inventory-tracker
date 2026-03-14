import { NavLink } from 'react-router-dom'

const routes = [
  { to: '/', label: 'Dashboard', mobileLabel: 'Dash' },
  { to: '/raw-buying', label: 'Raw Material', mobileLabel: 'Raw Mat' },
  { to: '/combimaker', label: 'Combimaker', mobileLabel: 'Combi' },
  { to: '/inventory', label: 'Inventory', mobileLabel: 'Inventory' },
  { to: '/sales', label: 'Sales', mobileLabel: 'Sales' },
  { to: '/logs', label: 'Movements', mobileLabel: 'Moves' },
]

export function AppNav() {
  return (
    <nav className="rounded-xl border border-slate-200 bg-white/90 p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
      <ul className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:gap-2 md:overflow-visible md:pb-0">
        {routes.map((route) => (
          <li className="shrink-0" key={route.to}>
            <NavLink
              to={route.to}
              end={route.to === '/'}
              className={({ isActive }) =>
                `inline-flex min-h-10 items-center justify-center rounded-lg px-2 py-2 text-xs font-medium transition-colors duration-150 md:min-h-8 md:px-3 md:text-sm ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`
              }
            >
              <span className="md:hidden">{route.mobileLabel}</span>
              <span className="hidden md:inline">{route.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
