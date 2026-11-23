import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { ThemeProvider } from '../theme/ThemeContext'
import { ChangePasswordPage } from './ChangePasswordPage'

vi.mock('../lib/api', () => ({
  api: {
    me: vi.fn().mockResolvedValue({ id: 'u1', username: '测试用户', createdAt: '2026-01-01T00:00:00Z' }),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter>
          <AuthProvider>
            <ChangePasswordPage />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('ChangePasswordPage', () => {
  it('未填当前密码时提示', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: '保存' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('请填写当前密码')
  })

  it('两次新密码不一致时提示', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText('当前密码'), 'secret123')
    await user.type(screen.getByLabelText('新密码'), 'newsecret1')
    await user.type(screen.getByLabelText('确认新密码'), 'different1')
    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('两次输入的新密码不一致')
  })

  it('修改成功后展示完成状态', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText('当前密码'), 'secret123')
    await user.type(screen.getByLabelText('新密码'), 'newsecret1')
    await user.type(screen.getByLabelText('确认新密码'), 'newsecret1')
    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText('密码已修改')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回大厅' })).toBeInTheDocument()
  })
})
