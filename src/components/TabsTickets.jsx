import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/tickets',     label: 'Soporte'     },
  { to: '/solicitudes', label: 'Solicitudes' },
]

export default function TabsTickets() {
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex">
      {tabs.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            `flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
              isActive
                ? 'text-gray-900 dark:text-white border-emerald-500'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}
