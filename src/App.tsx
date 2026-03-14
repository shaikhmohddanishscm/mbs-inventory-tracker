import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from './components/app/protected-route'
import { AppLayout } from '@/layout/app-layout'
import { CombiMakerPage } from '@/pages/combimaker-page'
import { DashboardPage } from '@/pages/dashboard-page'
import { InventoryPage } from '@/pages/inventory-page'
import { LoginPage } from './pages/login-page'
import { LogsPage } from '@/pages/logs-page'
import { RawBuyingPage } from '@/pages/raw-buying-page'
import { RawMaterialsPage } from '@/pages/raw-materials-page'
import { SalesPage } from '@/pages/sales-page'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="raw-materials" element={<RawMaterialsPage />} />
          <Route path="raw-buying" element={<RawBuyingPage />} />
          <Route path="combimaker" element={<CombiMakerPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
