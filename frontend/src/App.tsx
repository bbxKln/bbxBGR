import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { Spinner } from './components/ui'
import { AdminPage } from './pages/AdminPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { GroupPage } from './pages/GroupPage'
import { LobbyPage } from './pages/LobbyPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RegisterPage } from './pages/RegisterPage'

function Protected({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <LobbyPage />
          </Protected>
        }
      />
      <Route
        path="/groups/:groupId"
        element={
          <Protected>
            <GroupPage />
          </Protected>
        }
      />
      <Route path="/admin" element={<AdminPage />} />
      <Route
        path="/change-password"
        element={
          <Protected>
            <ChangePasswordPage />
          </Protected>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
