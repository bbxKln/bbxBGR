import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { todayString, validateSessionInput } from '../../lib/validation'
import type { Game, GameSession, Player, SessionInput } from '../../types'
import { Alert, Button, ChipToggle, Input, Modal } from '../../components/ui'

export function SessionFormModal({
  open,
  onClose,
  groupId,
  games,
  players,
  session,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  games: Game[]
  players: Player[]
  /** null = 新增 */
  session: GameSession | null
}) {
  // 由父组件通过 key 重挂载来重置表单状态
  const [gameId, setGameId] = useState(session?.gameId ?? '')
  const [playedAt, setPlayedAt] = useState(() => session?.playedAt ?? todayString())
  const [participantIds, setParticipantIds] = useState<string[]>(() => session?.participants.map((p) => p.playerId) ?? [])
  const [winnerIds, setWinnerIds] = useState<string[]>(() => session?.winners.map((w) => w.playerId) ?? [])
  const [mvpId, setMvpId] = useState(session?.mvp?.playerId ?? '')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const participantPlayers = useMemo(
    () => players.filter((p) => participantIds.includes(p.id)),
    [players, participantIds],
  )

  const toggleIn = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

  const mutation = useMutation({
    mutationFn: () => {
      const input: SessionInput = {
        gameId,
        playedAt,
        participantIds,
        winnerIds,
        mvpId: mvpId || undefined,
      }
      return session
        ? api.updateSession(groupId, session.id, input)
        : api.createSession(groupId, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['group', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      onClose()
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : '保存失败，请重试'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const validationError = validateSessionInput({
      gameId,
      playedAt,
      participantIds,
      winnerIds,
      mvpId: mvpId || undefined,
    })
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title={session ? '编辑场次' : '新增场次'}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div>
          <label htmlFor="session-game" className="mb-1.5 block text-sm font-medium text-ink">
            桌游
          </label>
          {games.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">
              还没有桌游，请先在「桌游」页添加
            </p>
          ) : (
            <select
              id="session-game"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">请选择</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <Input
          label="游玩时间"
          name="session-date"
          type="date"
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">参与玩家</p>
          <div className="flex flex-wrap gap-1.5">
            {players.map((player) => (
              <ChipToggle
                key={player.id}
                selected={participantIds.includes(player.id)}
                onClick={() => {
                  const next = toggleIn(participantIds, player.id)
                  setParticipantIds(next)
                  // 参与列表变化时，同步清理不再合法的获胜者与 MVP
                  setWinnerIds(winnerIds.filter((id) => next.includes(id)))
                  if (mvpId && !next.includes(mvpId)) setMvpId('')
                }}
              >
                {player.name}
              </ChipToggle>
            ))}
          </div>
          {players.length === 0 && (
            <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">
              还没有玩家，请先在「玩家」页添加
            </p>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">获胜玩家</p>
          {participantPlayers.length === 0 ? (
            <p className="text-xs text-muted">先选择参与玩家</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {participantPlayers.map((player) => (
                <ChipToggle
                  key={player.id}
                  tone="win"
                  selected={winnerIds.includes(player.id)}
                  onClick={() => setWinnerIds(toggleIn(winnerIds, player.id))}
                >
                  {player.name}
                </ChipToggle>
              ))}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="session-mvp" className="mb-1.5 block text-sm font-medium text-ink">
            MVP
          </label>
          <select
            id="session-mvp"
            value={mvpId}
            onChange={(e) => setMvpId(e.target.value)}
            disabled={participantPlayers.length === 0}
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          >
            <option value="">不选（选填）</option>
            {participantPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" className="flex-1" loading={mutation.isPending}>
            保存
          </Button>
        </div>
      </form>
    </Modal>
  )
}
