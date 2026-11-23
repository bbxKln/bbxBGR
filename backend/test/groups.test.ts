import { describe, expect, it } from 'vitest'
import { apiFetch, createGroup, errorOf, joinGroup, register, uniqueName } from './helpers'

describe('群组', () => {
  it('创建群组：8 位 ID 合法、创建者为 admin、大厅可见', async () => {
    const admin = await register(uniqueName('阿伦'))
    const group = await createGroup(admin, '周五桌游夜')
    expect(group.groupId).toMatch(/^[1-9]\d{7}$/)
    expect(group.role).toBe('admin')

    const list = await apiFetch('/api/v1/groups', { cookie: admin.cookie })
    const { groups } = (await list.json()) as { groups: { id: string; name: string; memberCount: number }[] }
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('周五桌游夜')
    expect(groups[0].memberCount).toBe(1)
  })

  it('凭群组 ID 加入：成员可见、重复加入 409、非法 ID 400、不存在 404', async () => {
    const admin = await register(uniqueName('阿伦'))
    const group = await createGroup(admin, '加入测试')
    const member = await register(uniqueName('小乙'))

    const joined = await joinGroup(member, group.groupId)
    expect(((joined as { group: { role: string } }).group).role).toBe('member')

    const dup = await apiFetch('/api/v1/groups/join', { method: 'POST', body: JSON.stringify({ groupId: group.groupId }), cookie: member.cookie })
    expect(dup.status).toBe(409)
    expect((await errorOf(dup)).code).toBe('ALREADY_MEMBER')

    const badFormat = await apiFetch('/api/v1/groups/join', { method: 'POST', body: JSON.stringify({ groupId: '01234567' }), cookie: member.cookie })
    expect(badFormat.status).toBe(400)
    expect((await errorOf(badFormat)).code).toBe('INVALID_GROUP_ID')

    const notFound = await apiFetch('/api/v1/groups/join', { method: 'POST', body: JSON.stringify({ groupId: '99999999' }), cookie: member.cookie })
    expect(notFound.status).toBe(404)
    expect((await errorOf(notFound)).code).toBe('GROUP_NOT_FOUND')

    // 加入者自动获得玩家档案
    const players = await apiFetch(`/api/v1/groups/${group.id}/players`, { cookie: admin.cookie })
    const { players: list } = (await players.json()) as { players: { name: string; userId: string | null }[] }
    expect(list.map((p) => p.name)).toContain(member.user.username)
  })

  it('非成员访问群组 → 403；解散后成员不再可见', async () => {
    const admin = await register(uniqueName('阿伦'))
    const group = await createGroup(admin, '解散测试')
    const member = await register(uniqueName('小乙'))
    await joinGroup(member, group.groupId)
    const outsider = await register(uniqueName('路人'))

    const forbidden = await apiFetch(`/api/v1/groups/${group.id}`, { cookie: outsider.cookie })
    expect(forbidden.status).toBe(403)
    expect((await errorOf(forbidden)).code).toBe('NOT_MEMBER')

    // 成员无权解散
    const memberDisband = await apiFetch(`/api/v1/groups/${group.id}`, { method: 'DELETE', cookie: member.cookie })
    expect(memberDisband.status).toBe(403)

    const disband = await apiFetch(`/api/v1/groups/${group.id}`, { method: 'DELETE', cookie: admin.cookie })
    expect(disband.status).toBe(204)

    const memberList = await apiFetch('/api/v1/groups', { cookie: member.cookie })
    expect(((await memberList.json()) as { groups: unknown[] }).groups).toHaveLength(0)
  })

  it('分析接口返回汇总、月度趋势与按玩家分桌游数据', async () => {
    const admin = await register(uniqueName('阿伦'))
    const group = await createGroup(admin, '分析测试')

    const game = await apiFetch(`/api/v1/groups/${group.id}/games`, {
      method: 'POST',
      body: JSON.stringify({ name: '卡坦岛', tags: ['策略'] }),
      cookie: admin.cookie,
    })
    expect(game.status).toBe(201)
    const { game: gameRow } = (await game.json()) as { game: { id: string } }

    const players = await apiFetch(`/api/v1/groups/${group.id}/players`, { cookie: admin.cookie })
    const { players: playerList } = (await players.json()) as { players: { id: string }[] }

    // 两场：双赢（1月）与单赢（2月）
    const mk = (playedAt: string, winnerIds: string[]) => ({
      gameId: gameRow.id,
      playedAt,
      participantIds: playerList.map((p) => p.id),
      winnerIds,
    })
    await apiFetch(`/api/v1/groups/${group.id}/sessions`, { method: 'POST', body: JSON.stringify(mk('2026-01-10', playerList.map((p) => p.id))), cookie: admin.cookie })
    await apiFetch(`/api/v1/groups/${group.id}/sessions`, { method: 'POST', body: JSON.stringify(mk('2026-02-15', [playerList[0].id])), cookie: admin.cookie })

    const analysis = await apiFetch(`/api/v1/groups/${group.id}/analysis`, { cookie: admin.cookie })
    expect(analysis.status).toBe(200)
    const data = (await analysis.json()) as {
      summary: { playerId: string; wins: number; played: number; winRate: number }[]
      months: string[]
      series: { playerId: string; points: { winRate: number | null }[] }[]
      perGame: Record<string, { gameName: string; winRate: number }[]>
    }
    // 单人双赢场景：p1 两场 2 胜 100%
    const p1 = data.summary.find((s) => s.playerId === playerList[0].id)!
    expect(p1.played).toBe(2)
    expect(p1.wins).toBe(2)
    expect(p1.winRate).toBe(1)
    expect(data.months).toEqual(['2026-01', '2026-02'])
    expect(data.series[0].points.map((p) => p.winRate)).toEqual([1, 1])
    expect(data.perGame[p1.playerId][0].gameName).toBe('卡坦岛')
  })
})
