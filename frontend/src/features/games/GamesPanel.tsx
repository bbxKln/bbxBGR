import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Game, GroupDetail } from '../../types'
import { Button, ConfirmModal, Spinner } from '../../components/ui'
import { GameFormModal } from './GameFormModal'

export function GamesPanel({ group }: { group: GroupDetail }) {
  const isManager = group.role === 'admin' || group.role === 'admin_user'
  const queryClient = useQueryClient()
  const gamesQuery = useQuery({ queryKey: ['games', group.id], queryFn: () => api.listGames(group.id) })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Game | null>(null)
  const [deleting, setDeleting] = useState<Game | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteGame(group.id, deleting!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['games', group.id] })
      void queryClient.invalidateQueries({ queryKey: ['sessions', group.id] })
      setDeleting(null)
    },
  })

  const games = gamesQuery.data ?? []
  const tagPool = [...new Set(games.flatMap((g) => g.tags))]

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">
          桌游 <span className="text-ink">{games.length}</span>
        </h2>
        {isManager && (
          <Button
            className="h-9"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            新增桌游
          </Button>
        )}
      </div>

      {gamesQuery.isPending ? (
        <div className="flex justify-center py-12 text-muted">
          <Spinner className="h-5 w-5" />
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <p className="text-sm text-muted">还没有桌游</p>
          <p className="mt-1 text-xs text-muted">添加常玩的桌游，记录场次时选择</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {games.map((game) => (
            <li key={game.id} className="rounded-lg border border-line bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{game.name}</p>
                  {game.description && <p className="mt-0.5 truncate text-xs text-muted">{game.description}</p>}
                  {game.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {game.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-bg px-2 py-0.5 text-xs text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="mr-1 text-xs text-muted">{game.sessionCount} 场</span>
                  {isManager && (
                    <>
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => {
                          setEditing(game)
                          setFormOpen(true)
                        }}
                      >
                        编辑
                      </Button>
                      <Button variant="ghost" className="h-8 px-2 text-xs text-danger" onClick={() => setDeleting(game)}>
                        删除
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <GameFormModal
        key={`${formOpen ? 'open' : 'closed'}-${editing?.id ?? 'new'}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        groupId={group.id}
        game={editing}
        tagSuggestions={tagPool}
      />
      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="删除桌游"
        confirmLabel="删除"
        message={
          deleting ? (
            <>
              删除「{deleting.name}」后，将无法再为它记录新场次。
              {deleting.sessionCount > 0 && (
                <>
                  <br />
                  已有 {deleting.sessionCount} 条历史场次，会继续保留。
                </>
              )}
            </>
          ) : null
        }
      />
    </section>
  )
}
