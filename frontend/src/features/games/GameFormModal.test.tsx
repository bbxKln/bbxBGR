import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameFormModal } from './GameFormModal'

vi.mock('../../lib/api', () => ({
  api: {
    createGame: vi.fn().mockResolvedValue({}),
    updateGame: vi.fn().mockResolvedValue({}),
  },
}))

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <GameFormModal
        open
        onClose={() => undefined}
        groupId="g1"
        game={null}
        tagSuggestions={['策略', '经营']}
      />
    </QueryClientProvider>,
  )
}

describe('GameFormModal 标签', () => {
  it('手动输入标签：回车添加、可移除', async () => {
    const user = userEvent.setup()
    renderModal()

    const input = screen.getByLabelText('标签')
    await user.type(input, '聚会{Enter}')
    expect(screen.getByText('聚会')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '移除标签 聚会' }))
    expect(screen.queryByText('聚会')).not.toBeInTheDocument()
  })

  it('点击已有标签直接添加，已添加的从建议区消失', async () => {
    const user = userEvent.setup()
    renderModal()

    expect(screen.getByText('已有标签（点击添加）')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '添加已有标签 策略' }))
    // 已选中的标签出现在选中区，且建议区不再出现
    expect(screen.getByRole('button', { name: '移除标签 策略' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '添加已有标签 策略' })).not.toBeInTheDocument()
    // 其他已有标签仍可点选
    expect(screen.getByRole('button', { name: '添加已有标签 经营' })).toBeInTheDocument()
  })
})
