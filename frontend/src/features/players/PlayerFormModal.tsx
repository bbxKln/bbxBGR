import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { MAX_PLAYER_NAME_LENGTH } from '../../lib/validation'
import type { Player } from '../../types'
import { Alert, Button, Input, Modal } from '../../components/ui'

export function PlayerFormModal({
  open,
  onClose,
  groupId,
  player,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  /** null = 新增 */
  player: Player | null
}) {
  // 由父组件通过 key 重挂载来重置表单状态
  const [name, setName] = useState(player?.name ?? '')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () =>
      player
        ? api.updatePlayer(groupId, player.id, { name })
        : api.createPlayer(groupId, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['players', groupId] })
      onClose()
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : '保存失败，请重试'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title={player ? '编辑玩家' : '新增玩家'}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Input
          label="姓名"
          name="player-name"
          placeholder="例如：阿伦"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_PLAYER_NAME_LENGTH}
          autoFocus
        />
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" className="flex-1" loading={mutation.isPending} disabled={!name.trim()}>
            保存
          </Button>
        </div>
      </form>
    </Modal>
  )
}
