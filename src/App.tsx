import { Routes, Route, NavLink } from 'react-router-dom'
import UploadPage from './components/UploadPage'
import TransactionsPage from './components/TransactionsPage'
import SummaryPage from './components/SummaryPage'
import RulesPage from './components/RulesPage'
import ManualEntryPage from './components/ManualEntryPage'
import TagsPage from './components/TagsPage'

const navItems = [
  { to: '/',             label: 'Upload' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/summary',      label: 'Summary' },
  { to: '/rules',        label: 'Rules & Categories' },
  { to: '/manual',       label: 'Manual Entry' },
  { to: '/tags',         label: 'Tags' },
]

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-lg text-white mr-4">ExpenseTracker</span>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `text-sm font-medium transition-colors ${
                isActive ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="p-6 max-w-6xl mx-auto">
        <Routes>
          <Route path="/"             element={<UploadPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/summary"      element={<SummaryPage />} />
          <Route path="/rules"        element={<RulesPage />} />
          <Route path="/manual"       element={<ManualEntryPage />} />
          <Route path="/tags"         element={<TagsPage />} />
        </Routes>
      </main>
    </div>
  )
}
