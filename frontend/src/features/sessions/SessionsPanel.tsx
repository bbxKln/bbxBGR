import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/validation'
import type { Game, GameSession, GroupDetail, Player } from '../../types'
import { Button, Spinner } from '../../components/ui'
import { SessionDetailModal } from './SessionDetailModal'
import { SessionFormModal } from './SessionFormModal'

export function SessionsPanel({ group }: { group: GroupDetail }) {
  const sessionsQuery = useQuery({ queryKey: ['sessions', group.id], queryFn: () => api.listSessions(group.id) })
  const gamesQuery = useQuery({ queryKey: ['games', group.id], queryFn: () => api.listGames(group.id) })
  const playersQuery = useQuery({ queryKey: ['players', group.id], queryFn: () => api.listPlayers(group.id) })

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GameSession | null>(null)
  const [viewing, setViewing] = useState<GameSession | null>(null)

  const sessions = sessionsQuery.data ?? []
  const games: Game[] = gamesQuery.data ?? []
  const players: Player[] = playersQuery.data ?? []

  const winnerNames = (session: GameSession) => session.winners.map((w) => w.name).join('、')

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">
          场次 <span className="text-ink">{sessions.length}</span>
        </h2>
        <Button
          className="h-9"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          新增场次
        </Button>
      </div>

      {sessionsQuery.isPending ? (
        <div className="flex justify-center py-12 text-muted">
          <Spinner className="h-5 w-5" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <p className="text-sm text-muted">还没有场次记录</p>
          <p className="mt-1 text-xs text-muted">记录第一局，胜率分析才有数据</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => setViewing(session)}
                className="w-full rounded-lg border border-line bg-surface p-3.5 text-left transition-colors hover:border-primary/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-ink">{session.gameName}</p>
                  <span className="shrink-0 text-xs text-muted">{formatDate(session.playedAt)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted">{session.participants.length} 人参与</span>
                  <span className="text-win">赢：{winnerNames(session)}</span>
                  {session.mvp && <span className="text-primary">MVP：{session.mvp.name}</span>}
                  {session.commentCount > 0 && <span className="text-muted">{session.commentCount} 条评论</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <SessionDetailModal
          open={viewing !== null}
          onClose={() => setViewing(null)}
          groupId={group.id}
          session={viewing}
          onEdit={() => {
            setEditing(viewing)
            setViewing(null)
            setFormOpen(true)
          }}
        />
      )}
      <SessionFormModal
        key={`${formOpen ? 'open' : 'closed'}-${editing?.id ?? 'new'}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        groupId={group.id}
        games={games}
        players={players}
        session={editing}
      />
    </section>
  )
}
