import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { MIN_PASSWORD_LENGTH } from '../lib/validation'
import { Alert, Button, Input, Modal } from './ui'

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setDone(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : '修改失败，请重试'),
  })

  const close = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError('')
    setDone(false)
    mutation.reset()
    onClose()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!current) {
      setError('请填写当前密码')
      return
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`新密码至少 ${MIN_PASSWORD_LENGTH} 位`)
      return
    }
    if (next !== confirm) {
      setError('两次输入的新密码不一致')
      return
    }
    setError('')
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={close} title={done ? '密码已修改' : '修改密码'}>
      {done ? (
        <div>
          <p className="text-sm text-muted">下次登录请使用新密码。</p>
          <Button className="mt-5 w-full" onClick={close}>
            完成
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Input
            label="当前密码"
            name="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
          />
          <Input
            label="新密码"
            name="new-password"
            type="password"
            hint={`至少 ${MIN_PASSWORD_LENGTH} 位`}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <Input
            label="确认新密码"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={close}>
              取消
            </Button>
            <Button type="submit" className="flex-1" loading={mutation.isPending}>
              保存
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
