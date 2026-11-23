import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatDate, formatDateTime, MAX_COMMENT_LENGTH } from '../../lib/validation'
import type { GameSession } from '../../types'
import { Alert, Button, ConfirmModal, Modal, Spinner, Textarea } from '../../components/ui'

export function SessionDetailModal({
  open,
  onClose,
  groupId,
  session,
  onEdit,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  session: GameSession
  onEdit: () => void
}) {
  const queryClient = useQueryClient()
  const commentsQuery = useQuery({
    queryKey: ['comments', groupId, session.id],
    queryFn: () => api.listComments(groupId, session.id),
    enabled: open,
  })
  // 父组件在每次打开时以新的 session 对象挂载本组件
  const [draft, setDraft] = useState(session.myComment ?? '')
  const [hasComment, setHasComment] = useState(session.myComment !== null)
  const [commentError, setCommentError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteSession(groupId, session.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      setConfirmDelete(false)
      onClose()
    },
  })

  const commentMutation = useMutation({
    mutationFn: () => api.upsertMyComment(groupId, session.id, draft),
    onSuccess: (data) => {
      setHasComment(data !== null)
      void queryClient.invalidateQueries({ queryKey: ['comments', groupId, session.id] })
      void queryClient.invalidateQueries({ queryKey: ['sessions', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] })
    },
    onError: (e: unknown) => setCommentError(e instanceof Error ? e.message : '保存失败，请重试'),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(groupId, session.id, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', groupId, session.id] })
      void queryClient.invalidateQueries({ queryKey: ['sessions', groupId] })
    },
  })

  const onSubmitComment = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setCommentError('')
    commentMutation.mutate()
  }

  const removeMyComment = () => {
    setDraft('')
    setCommentError('')
    commentMutation.mutate()
  }

  const comments = commentsQuery.data ?? []

  return (
    <Modal open={open} onClose={onClose} title={session.gameName}>
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{formatDate(session.playedAt)}</span>
          <span className="text-xs text-muted">由 {session.createdByName} 记录</span>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium text-muted">参与玩家（{session.participants.length}）</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {session.participants.map((p) => (
                <span key={p.playerId} className="rounded-lg border border-line bg-bg px-2.5 py-1 text-sm text-ink">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">获胜玩家</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {session.winners.map((p) => (
                <span key={p.playerId} className="rounded-lg border border-win bg-win/10 px-2.5 py-1 text-sm text-win">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
          {session.mvp && (
            <div>
              <p className="text-xs font-medium text-muted">MVP</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="rounded-lg border border-primary bg-primary/10 px-2.5 py-1 text-sm text-primary">
                  {session.mvp.name}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line pt-3">
          <p className="text-xs font-medium text-muted">评论（{comments.length}）</p>
          {commentsQuery.isPending ? (
            <div className="flex justify-center py-6 text-muted">
              <Spinner className="h-4 w-4" />
            </div>
          ) : comments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">还没有评论</p>
          ) : (
            <ul className="mt-2 space-y-2.5">
              {comments.map((comment) => (
                <li key={comment.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">
                      {comment.playerName} · {formatDateTime(comment.updatedAt)}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">{comment.content}</p>
                  </div>
                  {comment.canDelete && (
                    <Button
                      variant="ghost"
                      className="h-7 shrink-0 px-1.5 text-xs text-danger"
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                    >
                      删除
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {session.iAmParticipant ? (
          <form onSubmit={onSubmitComment} className="border-t border-line pt-3">
            {commentError && <div className="mb-2"><Alert>{commentError}</Alert></div>}
            <Textarea
              label="我的评论"
              name="my-comment"
              placeholder="这一局怎么样？"
              rows={2}
              value={draft}
              maxLength={MAX_COMMENT_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="mt-2 flex gap-3">
              <Button type="submit" className="flex-1" loading={commentMutation.isPending} disabled={!draft.trim()}>
                保存评论
              </Button>
              {hasComment && (
                <Button variant="outline" className="flex-1 text-danger" loading={commentMutation.isPending} onClick={removeMyComment}>
                  删除我的评论
                </Button>
              )}
            </div>
          </form>
        ) : (
          <p className="border-t border-line pt-3 text-xs text-muted">只有参与玩家可以留下评论</p>
        )}

        {session.canEdit && (
          <div className="flex gap-3 border-t border-line pt-3">
            <Button variant="outline" className="flex-1" onClick={onEdit}>
              编辑场次
            </Button>
            {session.canDelete && (
              <Button variant="outline" className="flex-1 text-danger" onClick={() => setConfirmDelete(true)}>
                删除场次
              </Button>
            )}
          </div>
        )}
      </div>
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="删除场次"
        confirmLabel="删除"
        message={`删除「${session.gameName}」这条场次记录？其评论会一并删除，无法恢复。`}
      />
    </Modal>
  )
}
