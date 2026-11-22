import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { MAX_GROUP_NAME_LENGTH } from '../lib/validation'
import type { GroupDetail } from '../types'
import { Alert, Button, Input, Modal } from './ui'

export function CreateGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState<GroupDetail | null>(null)
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => api.createGroup({ name }),
    onSuccess: (detail) => {
      setCreated(detail)
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : '创建失败，请重试'),
  })

  const reset = () => {
    setName('')
    setError('')
    setCreated(null)
    setCopied(false)
    mutation.reset()
  }

  const close = () => {
    reset()
    onClose()
  }

  const copyId = async () => {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.groupId)
      setCopied(true)
    } catch {
      // 剪贴板不可用时静默忽略，ID 仍可手动抄写
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={close} title={created ? '群组已创建' : '创建群组'}>
      {created ? (
        <div>
          <p className="text-sm text-muted">群组 ID 仅管理员可见，朋友可以凭它加入群组。</p>
          <div className="mt-4 flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-center font-mono text-lg font-semibold tracking-[0.2em] text-ink">
              {created.groupId}
            </code>
            <Button variant="outline" onClick={() => void copyId()}>
              {copied ? '已复制' : '复制'}
            </Button>
          </div>
          <Button className="mt-5 w-full" onClick={close}>
            完成
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Input
            label="群组名称"
            name="group-name"
            placeholder="例如：周五桌游夜"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_GROUP_NAME_LENGTH}
            autoFocus
          />
          <Button type="submit" className="w-full" loading={mutation.isPending} disabled={!name.trim()}>
            创建
          </Button>
        </form>
      )}
    </Modal>
  )
}
