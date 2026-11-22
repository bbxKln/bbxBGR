import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Alert, Button, Input, Modal } from './ui'

export function JoinGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [groupId, setGroupId] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => api.joinGroup(groupId),
    onSuccess: () => {
      setDone(true)
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : '加入失败，请重试'),
  })

  const reset = () => {
    setGroupId('')
    setError('')
    setDone(false)
    mutation.reset()
  }

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={close} title={done ? '已加入群组' : '加入群组'}>
      {done ? (
        <div>
          <p className="text-sm text-muted">群组已出现在你的「我的群组」里。</p>
          <Button className="mt-5 w-full" onClick={close}>
            完成
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Input
            label="群组 ID"
            name="group-id"
            inputMode="numeric"
            placeholder="输入 8 位数字"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value.replace(/\D/g, '').slice(0, 8))}
            autoFocus
          />
          <Button type="submit" className="w-full" loading={mutation.isPending} disabled={groupId.length !== 8}>
            加入
          </Button>
        </form>
      )}
    </Modal>
  )
}
