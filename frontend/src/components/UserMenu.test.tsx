import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
      <AuthProvider>
        <UserMenu />
      </AuthProvider>
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

  it('菜单中可打开修改密码弹窗', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(await screen.findByRole('button', { name: /测试用户/ }))
    await user.click(screen.getByRole('menuitem', { name: '修改密码' }))

    expect(await screen.findByRole('dialog', { name: '修改密码' })).toBeInTheDocument()
    expect(screen.getByLabelText('当前密码')).toBeInTheDocument()
    expect(screen.getByLabelText('新密码')).toBeInTheDocument()
    expect(screen.getByLabelText('确认新密码')).toBeInTheDocument()
  })

  it('两次新密码不一致时提示', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(await screen.findByRole('button', { name: /测试用户/ }))
    await user.click(screen.getByRole('menuitem', { name: '修改密码' }))
    await user.type(await screen.findByLabelText('当前密码'), 'secret123')
    await user.type(screen.getByLabelText('新密码'), 'newsecret1')
    await user.type(screen.getByLabelText('确认新密码'), 'different1')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('两次输入的新密码不一致')
  })
})
