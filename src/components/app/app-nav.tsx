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
      <ul className="grid grid-cols-3 gap-1 md:flex md:flex-wrap md:gap-2">
        {routes.map((route) => (
          <li key={route.to}>
            <NavLink
              to={route.to}
              end={route.to === '/'}
              className={({ isActive }) =>
                `flex w-full items-center justify-center rounded-lg px-1 py-2 text-xs font-medium transition-colors duration-150 md:min-h-8 md:px-3 md:text-sm ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`
              }
            >
              {route.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
