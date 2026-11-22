import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Button, ConfirmModal, Spinner } from '../../components/ui'
import { api, ROLE_LABELS } from '../../lib/api'
import { perPlayerPerGame } from '../../lib/analysis'
import type { GroupDetail, Player } from '../../types'
import { WinRateBars } from '../analysis/WinRateBars'
import { LinkPlayerModal } from './LinkPlayerModal'
import { PlayerFormModal } from './PlayerFormModal'

const EMPTY_SESSIONS: never[] = []
const EMPTY_GAMES: never[] = []

export function PlayersPanel({ group }: { group: GroupDetail }) {
  const isManager = group.role === 'admin' || group.role === 'admin_user'
  const isAdmin = group.role === 'admin'
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const playersQuery = useQuery({ queryKey: ['players', group.id], queryFn: () => api.listPlayers(group.id) })
  const sessionsQuery = useQuery({ queryKey: ['sessions', group.id], queryFn: () => api.listSessions(group.id) })
  const gamesQuery = useQuery({ queryKey: ['games', group.id], queryFn: () => api.listGames(group.id) })
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)

  const sessions = sessionsQuery.data ?? EMPTY_SESSIONS
  const games = gamesQuery.data ?? EMPTY_GAMES

  const statsByPlayer = useMemo(() => {
    const map = new Map<string, ReturnType<typeof perPlayerPerGame>>()
    for (const player of playersQuery.data ?? EMPTY_GAMES) {
      map.set(player.id, perPlayerPerGame(sessions, games, player.id))
    }
    return map
  }, [playersQuery.data, sessions, games])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)
  const [linking, setLinking] = useState<Player | null>(null)
  const [removing, setRemoving] = useState<Player | null>(null)
  const [disbandOpen, setDisbandOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const removeMutation = useMutation({
    mutationFn: () => api.deletePlayer(group.id, removing!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['players', group.id] })
      setRemoving(null)
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ playerId, role }: { playerId: string; role: 'admin_user' | 'member' }) =>
      api.assignRole(group.id, playerId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['players', group.id] })
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] })
    },
  })

  const disbandMutation = useMutation({
    mutationFn: () => api.disbandGroup(group.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      navigate('/', { replace: true })
    },
  })

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(group.groupId)
      setCopied(true)
    } catch {
      // 剪贴板不可用时静默忽略
    }
  }

  const players = playersQuery.data ?? []

  return (
    <section>
      {isAdmin && (
        <div className="mb-4 rounded-lg border border-line bg-surface p-3.5">
          <p className="text-xs font-medium text-muted">群组信息（仅管理员可见）</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <code className="flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-center font-mono text-base font-semibold tracking-[0.2em] text-ink">
              {group.groupId}
            </code>
            <Button variant="outline" className="h-9" onClick={() => void copyId()}>
              {copied ? '已复制' : '复制'}
            </Button>
            <Button variant="outline" className="h-9 text-danger" onClick={() => setDisbandOpen(true)}>
              解散群组
            </Button>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">
          玩家 <span className="text-ink">{players.length}</span>
        </h2>
        {isManager && (
          <Button
            className="h-9"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            新增玩家
          </Button>
        )}
      </div>

      {playersQuery.isPending ? (
        <div className="flex justify-center py-12 text-muted">
          <Spinner className="h-5 w-5" />
        </div>
      ) : players.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <p className="text-sm text-muted">还没有玩家</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {players.map((player) => {
            const isMe = player.userId === user?.id
            const expanded = expandedPlayerId === player.id
            return (
              <li key={player.id} className="rounded-lg border border-line bg-surface p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg text-sm font-semibold text-primary" aria-hidden="true">
                    {player.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span className="truncate">{player.name}</span>
                      {isMe && <span className="shrink-0 rounded-md bg-bg px-1.5 py-0.5 text-xs text-muted">我</span>}
                      {player.role === 'admin' && (
                        <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{ROLE_LABELS.admin}</span>
                      )}
                      {player.role === 'admin_user' && (
                        <span className="shrink-0 rounded-md bg-bg px-1.5 py-0.5 text-xs text-muted">{ROLE_LABELS.admin_user}</span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {player.linkedUsername ? `账号：${player.linkedUsername}` : '未关联账号'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isManager && (
                      <>
                        <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setEditing(player); setFormOpen(true) }}>
                          编辑
                        </Button>
                        <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setLinking(player)}>
                          关联账号
                        </Button>
                        {isAdmin && player.role === 'member' && player.userId && (
                          <Button
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            loading={roleMutation.isPending}
                            onClick={() => roleMutation.mutate({ playerId: player.id, role: 'admin_user' })}
                          >
                            设为协管
                          </Button>
                        )}
                        {isAdmin && player.role === 'admin_user' && (
                          <Button
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            loading={roleMutation.isPending}
                            onClick={() => roleMutation.mutate({ playerId: player.id, role: 'member' })}
                          >
                            取消协管
                          </Button>
                        )}
                        {(isAdmin || !player.userId) && (
                          <Button variant="ghost" className="h-8 px-2 text-xs text-danger" onClick={() => setRemoving(player)}>
                            {player.userId ? '移除' : '删除'}
                          </Button>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      aria-label={`查看${player.name}胜率`}
                      aria-expanded={expanded}
                      onClick={() => setExpandedPlayerId(expanded ? null : player.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-ink"
                    >
                      <svg
                        className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="mb-2 text-xs font-medium text-muted">各桌游胜率</p>
                    <WinRateBars
                      rows={(statsByPlayer.get(player.id) ?? []).map((row) => ({
                        name: row.gameName,
                        winRate: row.winRate,
                        wins: row.wins,
                        played: row.played,
                      }))}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <PlayerFormModal
        key={`${formOpen ? 'open' : 'closed'}-${editing?.id ?? 'new'}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        groupId={group.id}
        player={editing}
      />
      <LinkPlayerModal
        key={`${linking ? 'open' : 'closed'}-${linking?.id ?? 'new'}`}
        open={linking !== null}
        onClose={() => setLinking(null)}
        groupId={group.id}
        player={linking}
      />
      <ConfirmModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removeMutation.mutate()}
        loading={removeMutation.isPending}
        title={removing?.userId ? '移除成员' : '删除玩家'}
        confirmLabel={removing?.userId ? '移除' : '删除'}
        message={
          removing?.userId
            ? `移除「${removing.name}」后，对方将不再看到本群组；其历史场次与评论会保留。`
            : `删除玩家档案「${removing?.name}」后，历史场次中的记录会保留其名字。`
        }
      />
      <ConfirmModal
        open={disbandOpen}
        onClose={() => setDisbandOpen(false)}
        onConfirm={() => disbandMutation.mutate()}
        loading={disbandMutation.isPending}
        title="解散群组"
        confirmLabel="解散"
        message="解散后所有成员将无法访问本群组，数据无法恢复。确认解散？"
      />
    </section>
  )
}
