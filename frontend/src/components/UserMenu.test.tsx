import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { UserMenu } from './UserMenu'

vi.mock('../lib/api', () => ({
  api: {
    me: vi.fn().mockResolvedValue({ id: 'u-abc-123', username: '测试用户', createdAt: '2026-01-01T00:00:00Z' }),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
  },
}))

function renderMenu() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>
          <UserMenu />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('UserMenu', () => {
  it('展示用户名，展开后可见用户 ID 与菜单项', async () => {
    const user = userEvent.setup()
    renderMenu()

    const trigger = await screen.findByRole('button', { name: /测试用户/ })
    await user.click(trigger)

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('用户 ID')).toBeInTheDocument()
    expect(screen.getByText('u-abc-123')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '修改密码' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '退出登录' })).toBeInTheDocument()
  })

  it('修改密码跳转到独立页面', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(await screen.findByRole('button', { name: /测试用户/ }))
    const item = screen.getByRole('menuitem', { name: '修改密码' })
    expect(item).toHaveAttribute('href', '/change-password')
  })
})
