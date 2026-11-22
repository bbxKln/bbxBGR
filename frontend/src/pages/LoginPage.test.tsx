import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { LoginPage } from './LoginPage'

vi.mock('../lib/api', () => ({
  api: {
    me: vi.fn().mockResolvedValue(null),
    login: vi.fn().mockRejectedValue(new Error('用户名或密码不正确')),
    register: vi.fn(),
    logout: vi.fn(),
    listGroups: vi.fn(),
    createGroup: vi.fn(),
    joinGroup: vi.fn(),
  },
}))

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  it('未填用户名时提示', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: '登录' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('请填写用户名')
  })

  it('未填密码时提示', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText('用户名'), '阿伦')
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('请填写密码')
  })

  it('登录失败时展示服务端错误', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText('用户名'), '阿伦')
    await user.type(screen.getByLabelText('密码'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('用户名或密码不正确')
  })
})
