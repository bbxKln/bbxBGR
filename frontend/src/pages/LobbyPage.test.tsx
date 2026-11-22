import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { ThemeProvider } from '../theme/ThemeContext'
import { LobbyPage } from './LobbyPage'

vi.mock('../lib/api', () => ({
  api: {
    me: vi.fn().mockResolvedValue({ id: 'u1', username: '测试用户', createdAt: '2026-01-01T00:00:00Z' }),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    listGroups: vi.fn().mockResolvedValue([
      { id: 'g1', groupId: '12345678', name: '周五桌游夜', role: 'admin', memberCount: 3, sessionCount: 10 },
      { id: 'g2', groupId: '87654321', name: '周末开荒局', role: 'member', memberCount: 5, sessionCount: 2 },
    ]),
    createGroup: vi.fn(),
    joinGroup: vi.fn(),
  },
}))

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter>
          <AuthProvider>
            <LobbyPage />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('LobbyPage', () => {
  it('展示当前用户名与退出入口', async () => {
    renderPage()
    expect(await screen.findByText('测试用户')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument()
  })

  it('展示已加入的群组卡片与统计', async () => {
    renderPage()
    expect(await screen.findByText('周五桌游夜')).toBeInTheDocument()
    expect(screen.getByText('周末开荒局')).toBeInTheDocument()
    expect(screen.getByText('3 位成员 · 10 场记录')).toBeInTheDocument()
    expect(screen.getByText('5 位成员 · 2 场记录')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '创建群组' })).toBeInTheDocument()
  })
})
