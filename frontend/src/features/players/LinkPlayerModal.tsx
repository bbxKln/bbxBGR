import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Player } from '../../types'
import { Alert, Button, Input, Modal } from '../../components/ui'

/**
 * 关联/解除玩家档案的用户账号。
 * 关联后该用户登录时默认看到本群组（可评论、可被选为场次参与者）。
 */
export function LinkPlayerModal({
  open,
  onClose,
  groupId,
  player,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  player: Player | null
}) {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => api.linkPlayer(groupId, player!.id, username.trim() || null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['players', groupId] })
      onClose()
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : '保存失败，请重试'),
  })

  const unlinkMutation = useMutation({
    mutationFn: () => api.linkPlayer(groupId, player!.id, null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['players', groupId] })
      onClose()
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : '操作失败，请重试'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    mutation.mutate()
  }

  if (!player) return null

  return (
    <Modal open={open} onClose={onClose} title="关联账号">
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-muted">
          关联后，「{player.name}」登录时会默认看到本群组，并能参与评论。
        </p>
        {player.linkedUsername && (
          <p className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink">
            当前关联：{player.linkedUsername}
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="对方用户名"
            name="link-username"
            placeholder="输入对方已注册的用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" className="flex-1" loading={mutation.isPending} disabled={!username.trim()}>
              关联
            </Button>
          </div>
        </form>
        {player.linkedUsername && (
          <Button variant="outline" className="w-full text-danger" loading={unlinkMutation.isPending} onClick={() => unlinkMutation.mutate()}>
            解除关联
          </Button>
        )}
      </div>
    </Modal>
  )
}
