import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { ThemeProvider } from '../theme/ThemeContext'
import { GroupPage } from './GroupPage'

const baseGroup = {
  id: 'g1',
  groupId: '12345678',
  name: '周五桌游夜',
  memberCount: 3,
  sessionCount: 4,
  createdBy: 'u1',
  createdAt: '2026-11-01T00:00:00Z',
}

vi.mock('../lib/api', () => ({
  ROLE_LABELS: { admin: '管理员', admin_user: '协管', member: '成员' },
  api: {
    me: vi.fn().mockResolvedValue({ id: 'u1', username: '阿伦', createdAt: '2026-11-01T00:00:00Z' }),
    getGroup: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([]),
    listGames: vi.fn().mockResolvedValue([]),
    listPlayers: vi.fn().mockResolvedValue([]),
    createSession: vi.fn(),
    createGame: vi.fn(),
    createPlayer: vi.fn(),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/groups/g1']}>
          <AuthProvider>
            <Routes>
              <Route path="/groups/:groupId" element={<GroupPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('GroupPage', () => {
  it('管理员看到群组名、角色徽标与三个模块入口', async () => {
    const { api } = await import('../lib/api')
    vi.mocked(api.getGroup).mockResolvedValue({ ...baseGroup, role: 'admin' })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: /周五桌游夜/ })).toBeInTheDocument()
    expect(screen.getByText('管理员')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '场次' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '桌游' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '玩家' })).toBeInTheDocument()

    // 管理员在桌游页看到新增入口
    await user.click(screen.getByRole('tab', { name: '桌游' }))
    expect(await screen.findByRole('button', { name: '新增桌游' })).toBeInTheDocument()
  })

  it('普通成员看不到管理入口', async () => {
    const { api } = await import('../lib/api')
    vi.mocked(api.getGroup).mockResolvedValue({ ...baseGroup, role: 'member' })
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { name: /周五桌游夜/ })
    expect(screen.queryByText('管理员')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: '桌游' }))
    await screen.findByText('还没有桌游')
    expect(screen.queryByRole('button', { name: '新增桌游' })).not.toBeInTheDocument()
  })

  it('非成员显示错误提示与返回大厅', async () => {
    const { api } = await import('../lib/api')
    vi.mocked(api.getGroup).mockRejectedValue(new Error('你不在这个群组里'))
    renderPage()

    expect(await screen.findByText('无法进入群组')).toBeInTheDocument()
    expect(screen.getByText('你不在这个群组里')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回大厅' })).toBeInTheDocument()
  })
})
