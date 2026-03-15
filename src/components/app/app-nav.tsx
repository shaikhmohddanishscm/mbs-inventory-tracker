import { NavLink } from 'react-router-dom'

const leftRoutes = [
  { to: '/', label: 'Dashboard', mobileLabel: 'Dash' },
  { to: '/combimaker', label: 'Combimaker', mobileLabel: 'Combi' },
]

const rightRoutes = [
  {
    to: '/raw-material', label: 'Raw Material', mobileLabel: 'Raw Mat',
    active: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-white',
    inactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-800/50',
  },
  {
    to: '/inventory', label: 'Inventory', mobileLabel: 'Inventory',
    active: 'bg-violet-600 text-white dark:bg-violet-500 dark:text-white',
    inactive: 'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/40 dark:text-violet-200 dark:hover:bg-violet-800/50',
  },
  {
    to: '/sales', label: 'Sales', mobileLabel: 'Sales',
    active: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white',
    inactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-800/50',
  },
]

export function AppNav() {
  return (
    <nav className="rounded-xl border border-slate-200 bg-white/90 p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Left group: Dashboard, Combimaker */}
        <ul className="grid grid-cols-2 gap-1 sm:flex sm:gap-2">
          {leftRoutes.map((route) => (
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

        {/* Right group: Raw Material, Inventory, Sales — with accent color */}
        <ul className="grid grid-cols-3 gap-1 sm:flex sm:gap-2">
          {rightRoutes.map((route) => (
            <li key={route.to}>
              <NavLink
                to={route.to}
                end
                className={({ isActive }) =>
                  `flex w-full items-center justify-center rounded-lg px-1 py-2 text-xs font-medium transition-colors duration-150 md:min-h-8 md:px-3 md:text-sm ${
                    isActive ? route.active : route.inactive
                  }`
                }
              >
                {route.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
