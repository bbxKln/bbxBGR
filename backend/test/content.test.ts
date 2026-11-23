import { describe, expect, it } from 'vitest'
import { apiFetch, createGroup, errorOf, joinGroup, register, uniqueName } from './helpers'

interface Setup {
  admin: Awaited<ReturnType<typeof register>>
  member: Awaited<ReturnType<typeof register>>
  adminUser: Awaited<ReturnType<typeof register>>
  outsider: Awaited<ReturnType<typeof register>>
  group: { id: string; groupId: string }
  gameId: string
  playerIds: { admin: string; member: string; adminUser: string }
}

async function setupGroup(): Promise<Setup> {
  const admin = await register(uniqueName('阿伦'))
  const member = await register(uniqueName('小乙'))
  const adminUser = await register(uniqueName('小丙'))
  const outsider = await register(uniqueName('路人'))
  const group = await createGroup(admin, '内容测试')
  await joinGroup(member, group.groupId)
  await joinGroup(adminUser, group.groupId)

  const gameRes = await apiFetch(`/api/v1/groups/${group.id}/games`, {
    method: 'POST',
    body: JSON.stringify({ name: '卡坦岛', tags: ['策略', '经营'] }),
    cookie: admin.cookie,
  })
  const { game } = (await gameRes.json()) as { game: { id: string } }

  const playersRes = await apiFetch(`/api/v1/groups/${group.id}/players`, { cookie: admin.cookie })
  const { players } = (await playersRes.json()) as { players: { id: string; userId: string | null }[] }
  const byUser = (id: string) => players.find((p) => p.userId === id)!.id

  // admin 把 adminUser 设为协管
  const roleRes = await apiFetch(`/api/v1/groups/${group.id}/players/${byUser(adminUser.user.id)}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role: 'admin_user' }),
    cookie: admin.cookie,
  })
  expect(roleRes.status).toBe(204)

  return {
    admin,
    member,
    adminUser,
    outsider,
    group,
    gameId: game.id,
    playerIds: { admin: byUser(admin.user.id), member: byUser(member.user.id), adminUser: byUser(adminUser.user.id) },
  }
}

describe('桌游', () => {
  it('成员无权新增（403），管理员可增改删（软删除后场次保留名字）', async () => {
    const s = await setupGroup()
    const forbidden = await apiFetch(`/api/v1/groups/${s.group.id}/games`, {
      method: 'POST',
      body: JSON.stringify({ name: '阿瓦隆', tags: [] }),
      cookie: s.member.cookie,
    })
    expect(forbidden.status).toBe(403)

    const created = await apiFetch(`/api/v1/groups/${s.group.id}/games`, {
      method: 'POST',
      body: JSON.stringify({ name: '阿瓦隆', tags: ['聚会', ' 聚会 '] }),
      cookie: s.admin.cookie,
    })
    expect(created.status).toBe(201)
    const { game } = (await created.json()) as { game: { id: string; tags: string[] } }
    expect(game.tags).toEqual(['聚会'])

    // 非法标签
    const badTags = await apiFetch(`/api/v1/groups/${s.group.id}/games`, {
      method: 'POST',
      body: JSON.stringify({ name: '坏标签', tags: ['一二三四五六七八九十一二三四五六'] }),
      cookie: s.admin.cookie,
    })
    expect(badTags.status).toBe(400)

    // 软删除后场次保留名字
    await apiFetch(`/api/v1/groups/${s.group.id}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ gameId: game.id, playedAt: '2026-11-01', participantIds: [s.playerIds.admin], winnerIds: [s.playerIds.admin] }),
      cookie: s.admin.cookie,
    })
    const del = await apiFetch(`/api/v1/groups/${s.group.id}/games/${game.id}`, { method: 'DELETE', cookie: s.admin.cookie })
    expect(del.status).toBe(204)
    const list = await apiFetch(`/api/v1/groups/${s.group.id}/games`, { cookie: s.member.cookie })
    expect(((await list.json()) as { games: unknown[] }).games).toHaveLength(1) // 只剩卡坦岛
    const sessions = await apiFetch(`/api/v1/groups/${s.group.id}/sessions`, { cookie: s.member.cookie })
    const { sessions: sessionList } = (await sessions.json()) as { sessions: { gameName: string }[] }
    expect(sessionList[0].gameName).toBe('阿瓦隆')
  })
})

describe('玩家与角色', () => {
  it('关联账号自动入群；未关联不能分配角色；不能改管理员角色', async () => {
    const s = await setupGroup()
    // 新增无关联玩家
    const created = await apiFetch(`/api/v1/groups/${s.group.id}/players`, {
      method: 'POST',
      body: JSON.stringify({ name: '无名' }),
      cookie: s.admin.cookie,
    })
    const { player } = (await created.json()) as { player: { id: string } }

    const notLinked = await apiFetch(`/api/v1/groups/${s.group.id}/players/${player.id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: 'admin_user' }),
      cookie: s.admin.cookie,
    })
    expect(notLinked.status).toBe(400)
    expect((await errorOf(notLinked)).code).toBe('NOT_LINKED')

    // 关联路人（自动入群）
    const linked = await apiFetch(`/api/v1/groups/${s.group.id}/players/${player.id}/link`, {
      method: 'PUT',
      body: JSON.stringify({ username: s.outsider.user.username }),
      cookie: s.admin.cookie,
    })
    expect(linked.status).toBe(200)
    const outsiderGroups = await apiFetch('/api/v1/groups', { cookie: s.outsider.cookie })
    expect(((await outsiderGroups.json()) as { groups: unknown[] }).groups).toHaveLength(1)

    // 不能修改管理员角色
    const adminRole = await apiFetch(`/api/v1/groups/${s.group.id}/players/${s.playerIds.admin}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: 'member' }),
      cookie: s.admin.cookie,
    })
    expect(adminRole.status).toBe(403)

    // 关联不存在的用户名
    const badLink = await apiFetch(`/api/v1/groups/${s.group.id}/players/${player.id}/link`, {
      method: 'PUT',
      body: JSON.stringify({ username: '不存在的人' }),
      cookie: s.admin.cookie,
    })
    expect(badLink.status).toBe(404)
    expect((await errorOf(badLink)).code).toBe('USER_NOT_FOUND')
  })

  it('只有 admin 能移除已关联成员；协管可删未关联玩家', async () => {
    const s = await setupGroup()
    const byAdminUser = await apiFetch(`/api/v1/groups/${s.group.id}/players/${s.playerIds.member}`, {
      method: 'DELETE',
      cookie: s.adminUser.cookie,
    })
    expect(byAdminUser.status).toBe(403)

    const byAdmin = await apiFetch(`/api/v1/groups/${s.group.id}/players/${s.playerIds.member}`, {
      method: 'DELETE',
      cookie: s.admin.cookie,
    })
    expect(byAdmin.status).toBe(204)
    const memberGroups = await apiFetch('/api/v1/groups', { cookie: s.member.cookie })
    expect(((await memberGroups.json()) as { groups: unknown[] }).groups).toHaveLength(0)
  })
})

describe('场次', () => {
  it('校验获胜者/MVP 必须属于参与玩家；删除的桌游不能开新场次', async () => {
    const s = await setupGroup()
    const base = { gameId: s.gameId, playedAt: '2026-11-20', participantIds: [s.playerIds.admin] }
    const cases: { extra: { winnerIds: string[]; mvpId?: string }; code: string }[] = [
      { extra: { winnerIds: [s.playerIds.member] }, code: 'INVALID_SESSION' },
      { extra: { winnerIds: [s.playerIds.admin], mvpId: s.playerIds.member }, code: 'INVALID_SESSION' },
      { extra: { winnerIds: [] }, code: 'INVALID_SESSION' },
    ]
    for (const { extra, code } of cases) {
      const res = await apiFetch(`/api/v1/groups/${s.group.id}/sessions`, {
        method: 'POST',
        body: JSON.stringify({ ...base, ...extra }),
        cookie: s.admin.cookie,
      })
      expect(res.status).toBe(400)
      expect((await errorOf(res)).code).toBe(code)
    }

    await apiFetch(`/api/v1/groups/${s.group.id}/games/${s.gameId}`, { method: 'DELETE', cookie: s.admin.cookie })
    const res = await apiFetch(`/api/v1/groups/${s.group.id}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ ...base, winnerIds: [s.playerIds.admin] }),
      cookie: s.admin.cookie,
    })
    expect(res.status).toBe(400)
    expect((await errorOf(res)).code).toBe('GAME_NOT_FOUND')
  })

  it('编辑/删除权限：创建者可操作，其他成员 403', async () => {
    const s = await setupGroup()
    const created = await apiFetch(`/api/v1/groups/${s.group.id}/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        gameId: s.gameId,
        playedAt: '2026-11-20',
        participantIds: [s.playerIds.admin, s.playerIds.member],
        winnerIds: [s.playerIds.member],
      }),
      cookie: s.member.cookie,
    })
    expect(created.status).toBe(201)
    const { session } = (await created.json()) as { session: { id: string; iAmParticipant: boolean } }
    expect(session.iAmParticipant).toBe(true)

    // 创建者是 member（可编辑自己创建的场次）
    const patchByCreator = await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        gameId: s.gameId,
        playedAt: '2026-11-21',
        participantIds: [s.playerIds.admin, s.playerIds.member],
        winnerIds: [s.playerIds.admin],
      }),
      cookie: s.member.cookie,
    })
    expect(patchByCreator.status).toBe(200)

    // 管理员（非创建者）可编辑；协管也可
    for (const cookie of [s.admin.cookie, s.adminUser.cookie]) {
      const res = await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          gameId: s.gameId,
          playedAt: '2026-11-22',
          participantIds: [s.playerIds.admin, s.playerIds.member],
          winnerIds: [s.playerIds.member],
        }),
        cookie,
      })
      expect(res.status).toBe(200)
    }

    const patchByOutsider = await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        gameId: s.gameId,
        playedAt: '2026-11-23',
        participantIds: [s.playerIds.admin],
        winnerIds: [s.playerIds.admin],
      }),
      cookie: s.outsider.cookie,
    })
    expect(patchByOutsider.status).toBe(403)
  })
})

describe('评论', () => {
  it('参与者写/改/删自己的评论；非参与者 403；协管可删任意', async () => {
    const s = await setupGroup()
    const created = await apiFetch(`/api/v1/groups/${s.group.id}/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        gameId: s.gameId,
        playedAt: '2026-11-20',
        participantIds: [s.playerIds.admin, s.playerIds.member],
        winnerIds: [s.playerIds.admin],
      }),
      cookie: s.admin.cookie,
    })
    const { session } = (await created.json()) as { session: { id: string } }

    // 非参与者（协管不在名单）→ 403
    const outsiderComment = await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}/comments/mine`, {
      method: 'PUT',
      body: JSON.stringify({ content: '我没参加' }),
      cookie: s.adminUser.cookie,
    })
    expect(outsiderComment.status).toBe(403)

    // 参与者留评论 → 编辑 → 删除（空内容）
    const put = await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}/comments/mine`, {
      method: 'PUT',
      body: JSON.stringify({ content: '第一局，很精彩' }),
      cookie: s.member.cookie,
    })
    expect(put.status).toBe(200)
    const edited = await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}/comments/mine`, {
      method: 'PUT',
      body: JSON.stringify({ content: '第一局，逆风翻盘' }),
      cookie: s.member.cookie,
    })
    expect(((await edited.json()) as { comment: { content: string } }).comment.content).toBe('第一局，逆风翻盘')

    const list = await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}/comments`, { cookie: s.member.cookie })
    const { comments } = (await list.json()) as { comments: { id: string; canDelete: boolean }[] }
    expect(comments).toHaveLength(1)
    const commentId = comments[0].id

    // 普通成员不能删别人的评论
    const memberDelete = await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}/comments/${commentId}`, {
      method: 'DELETE',
      cookie: s.member.cookie,
    })
    expect(memberDelete.status).toBe(403)

    // 协管可删
    const managerDelete = await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}/comments/${commentId}`, {
      method: 'DELETE',
      cookie: s.adminUser.cookie,
    })
    expect(managerDelete.status).toBe(204)

    // 删除自己的评论（空内容）
    await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}/comments/mine`, {
      method: 'PUT',
      body: JSON.stringify({ content: '再写一条' }),
      cookie: s.member.cookie,
    })
    const remove = await apiFetch(`/api/v1/groups/${s.group.id}/sessions/${session.id}/comments/mine`, {
      method: 'PUT',
      body: JSON.stringify({ content: '' }),
      cookie: s.member.cookie,
    })
    expect(remove.status).toBe(200)
    expect(((await remove.json()) as { comment: null }).comment).toBeNull()
  })
})

describe('权限矩阵', () => {
  it('各角色对各接口的状态码符合预期（每个用例独立建群，避免状态污染）', async () => {
    type CaseFn = (s: Setup, cookie: string) => Promise<Response>
    const cases: { name: string; fn: CaseFn; expected: Record<string, number> }[] = [
      {
        name: '新增桌游',
        fn: (s, cookie) =>
          apiFetch(`/api/v1/groups/${s.group.id}/games`, {
            method: 'POST',
            body: JSON.stringify({ name: '矩阵桌游', tags: [] }),
            cookie,
          }),
        expected: { admin: 201, admin_user: 201, member: 403, outsider: 403 },
      },
      {
        name: '分配角色',
        fn: (s, cookie) =>
          apiFetch(`/api/v1/groups/${s.group.id}/players/${s.playerIds.member}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role: 'admin_user' }),
            cookie,
          }),
        expected: { admin: 204, admin_user: 403, member: 403, outsider: 403 },
      },
      {
        name: '删除已关联玩家',
        fn: (s, cookie) => apiFetch(`/api/v1/groups/${s.group.id}/players/${s.playerIds.member}`, { method: 'DELETE', cookie }),
        expected: { admin: 204, admin_user: 403, member: 403, outsider: 403 },
      },
      {
        name: '解散群组',
        fn: (s, cookie) => apiFetch(`/api/v1/groups/${s.group.id}`, { method: 'DELETE', cookie }),
        expected: { admin: 204, admin_user: 403, member: 403, outsider: 403 },
      },
      {
        name: '新增场次',
        fn: (s, cookie) =>
          apiFetch(`/api/v1/groups/${s.group.id}/sessions`, {
            method: 'POST',
            body: JSON.stringify({
              gameId: s.gameId,
              playedAt: '2026-11-20',
              participantIds: [s.playerIds.admin],
              winnerIds: [s.playerIds.admin],
            }),
            cookie,
          }),
        expected: { admin: 201, admin_user: 201, member: 201, outsider: 403 },
      },
    ]

    for (const tc of cases) {
      for (const [role] of Object.entries(tc.expected)) {
        // 每个角色独立建群，避免用例内的状态污染
        const s = await setupGroup()
        const clients: Record<string, string> = {
          admin: s.admin.cookie,
          admin_user: s.adminUser.cookie,
          member: s.member.cookie,
          outsider: s.outsider.cookie,
        }
        const res = await tc.fn(s, clients[role])
        expect(res.status, `${tc.name} × ${role} 期望 ${tc.expected[role]}，实际 ${res.status}`).toBe(tc.expected[role])
      }
    }
  })
})
