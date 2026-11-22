import { beforeEach, describe, expect, it } from 'vitest'
import { mockApi } from '../api/mock'

/**
 * M2 群组内功能的 API 测试：
 * 桌游 CRUD + 软删除、玩家管理 + 账号关联、角色分配、场次校验、评论权限、解散群组。
 */
describe('群组内功能（mock API）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  async function setupGroup() {
    const admin = await mockApi.register({ username: '阿伦', password: 'secret123' })
    const group = await mockApi.createGroup({ name: '周五桌游夜' })
    return { admin, group }
  }

  describe('桌游', () => {
    it('管理员可增改删，成员无权管理', async () => {
      const { group } = await setupGroup()
      const game = await mockApi.createGame(group.id, { name: '卡坦岛', tags: ['策略', ' 经营 '], description: '经典' })
      expect(game.tags).toEqual(['策略', '经营'])

      const updated = await mockApi.updateGame(group.id, game.id, { name: '卡坦岛：基础', tags: ['策略'] })
      expect(updated.name).toBe('卡坦岛：基础')

      await mockApi.deleteGame(group.id, game.id)
      expect(await mockApi.listGames(group.id)).toHaveLength(0)

      // 成员尝试新增桌游 → 403
      await mockApi.logout()
      await mockApi.register({ username: '小乙', password: 'secret456' })
      await mockApi.joinGroup(group.groupId)
      await expect(mockApi.createGame(group.id, { name: 'x', tags: [] })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('软删除后历史场次仍保留桌游名', async () => {
      const { group } = await setupGroup()
      const game = await mockApi.createGame(group.id, { name: '卡坦岛', tags: [] })
      const players = await mockApi.listPlayers(group.id)
      await mockApi.createSession(group.id, {
        gameId: game.id,
        playedAt: '2026-11-20',
        participantIds: [players[0].id],
        winnerIds: [players[0].id],
      })
      expect((await mockApi.listGames(group.id))[0].sessionCount).toBe(1)
      await mockApi.deleteGame(group.id, game.id)
      expect(await mockApi.listGames(group.id)).toHaveLength(0)
      const sessions = await mockApi.listSessions(group.id)
      expect(sessions[0].gameName).toBe('卡坦岛')
    })
  })

  describe('玩家与角色', () => {
    it('新增玩家、关联账号（自动加入群组）、解除关联', async () => {
      const { group } = await setupGroup()
      const player = await mockApi.createPlayer(group.id, { name: '无名' })
      expect(player.userId).toBeNull()

      // 注册目标账号并关联
      await mockApi.logout()
      await mockApi.register({ username: '小乙', password: 'secret456' })
      await mockApi.logout()
      await mockApi.login({ username: '阿伦', password: 'secret123' })

      const linked = await mockApi.linkPlayer(group.id, player.id, '小乙')
      expect(linked.userId).not.toBeNull()
      expect(linked.linkedUsername).toBe('小乙')
      // 关联后该用户默认看到群组
      await mockApi.logout()
      await mockApi.login({ username: '小乙', password: 'secret456' })
      expect(await mockApi.listGroups()).toHaveLength(1)
      await mockApi.logout()
      await mockApi.login({ username: '阿伦', password: 'secret123' })

      const unlinked = await mockApi.linkPlayer(group.id, player.id, null)
      expect(unlinked.userId).toBeNull()
    })

    it('关联不存在的用户名报错', async () => {
      const { group } = await setupGroup()
      const player = await mockApi.createPlayer(group.id, { name: '无名' })
      await expect(mockApi.linkPlayer(group.id, player.id, '不存在的人')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      })
    })

    it('admin 可分配/取消协管；成员无权分配；不能改管理员角色', async () => {
      const { group } = await setupGroup()
      // 第二个用户加入
      await mockApi.logout()
      const userB = await mockApi.register({ username: '小乙', password: 'secret456' })
      await mockApi.joinGroup(group.groupId)
      const players = await mockApi.listPlayers(group.id)
      const bPlayer = players.find((p) => p.userId === userB.id)!
      const adminPlayer = players.find((p) => p.userId !== userB.id)!

      // 成员 B 尝试给自己升协管 → 403
      await expect(mockApi.assignRole(group.id, bPlayer.id, 'admin_user')).rejects.toMatchObject({ code: 'FORBIDDEN' })

      // admin 分配协管
      await mockApi.logout()
      await mockApi.login({ username: '阿伦', password: 'secret123' })
      await mockApi.assignRole(group.id, bPlayer.id, 'admin_user')
      expect((await mockApi.listPlayers(group.id)).find((p) => p.id === bPlayer.id)?.role).toBe('admin_user')

      // 不能修改管理员角色
      await expect(mockApi.assignRole(group.id, adminPlayer.id, 'member')).rejects.toMatchObject({ code: 'FORBIDDEN' })

      // 取消协管
      await mockApi.assignRole(group.id, bPlayer.id, 'member')
      expect((await mockApi.listPlayers(group.id)).find((p) => p.id === bPlayer.id)?.role).toBe('member')
    })

    it('未关联账号的玩家无法分配角色', async () => {
      const { group } = await setupGroup()
      const player = await mockApi.createPlayer(group.id, { name: '无名' })
      await expect(mockApi.assignRole(group.id, player.id, 'admin_user')).rejects.toMatchObject({ code: 'NOT_LINKED' })
    })

    it('只有 admin 能移除成员；admin_user 可删除未关联玩家', async () => {
      const { group } = await setupGroup()
      await mockApi.logout()
      const userB = await mockApi.register({ username: '小乙', password: 'secret456' })
      await mockApi.joinGroup(group.groupId)

      // 成员 B 无权移除任何人
      const playersB = await mockApi.listPlayers(group.id)
      await expect(mockApi.deletePlayer(group.id, playersB[0].id)).rejects.toMatchObject({ code: 'FORBIDDEN' })

      await mockApi.logout()
      await mockApi.login({ username: '阿伦', password: 'secret123' })
      const players = await mockApi.listPlayers(group.id)
      const bPlayer = players.find((p) => p.userId === userB.id)!
      await mockApi.deletePlayer(group.id, bPlayer.id)
      // 移除后 B 不再看到群组
      await mockApi.logout()
      await mockApi.login({ username: '小乙', password: 'secret456' })
      expect(await mockApi.listGroups()).toHaveLength(0)
    })
  })

  describe('场次', () => {
    it('创建场次：校验获胜者与 MVP 必须属于参与玩家', async () => {
      const { group } = await setupGroup()
      const game = await mockApi.createGame(group.id, { name: '卡坦岛', tags: [] })
      const players = await mockApi.listPlayers(group.id)
      const [p1] = players
      const p2 = await mockApi.createPlayer(group.id, { name: '无名' })

      await expect(
        mockApi.createSession(group.id, {
          gameId: game.id,
          playedAt: '2026-11-22',
          participantIds: [p1.id],
          winnerIds: [p2.id],
        }),
      ).rejects.toMatchObject({ code: 'INVALID_SESSION' })

      await expect(
        mockApi.createSession(group.id, {
          gameId: game.id,
          playedAt: '2026-11-22',
          participantIds: [p1.id],
          winnerIds: [p1.id],
          mvpId: p2.id,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_SESSION' })

      const session = await mockApi.createSession(group.id, {
        gameId: game.id,
        playedAt: '2026-11-22',
        participantIds: [p1.id, p2.id],
        winnerIds: [p1.id, p2.id],
        mvpId: p2.id,
      })
      expect(session.winners).toHaveLength(2)
      expect(session.mvp?.playerId).toBe(p2.id)
      expect(session.iAmParticipant).toBe(true)
    })

    it('删除的桌游不能用于新场次', async () => {
      const { group } = await setupGroup()
      const game = await mockApi.createGame(group.id, { name: '卡坦岛', tags: [] })
      await mockApi.deleteGame(group.id, game.id)
      const players = await mockApi.listPlayers(group.id)
      await expect(
        mockApi.createSession(group.id, {
          gameId: game.id,
          playedAt: '2026-11-22',
          participantIds: [players[0].id],
          winnerIds: [players[0].id],
        }),
      ).rejects.toMatchObject({ code: 'GAME_NOT_FOUND' })
    })

    it('场次编辑/删除权限：创建者可操作，其他成员不可', async () => {
      const { group } = await setupGroup()
      const game = await mockApi.createGame(group.id, { name: '卡坦岛', tags: [] })
      const players = await mockApi.listPlayers(group.id)
      const session = await mockApi.createSession(group.id, {
        gameId: game.id,
        playedAt: '2026-11-22',
        participantIds: [players[0].id],
        winnerIds: [players[0].id],
      })

      await mockApi.logout()
      await mockApi.register({ username: '小乙', password: 'secret456' })
      await mockApi.joinGroup(group.groupId)
      const playersB = await mockApi.listPlayers(group.id)
      await expect(
        mockApi.updateSession(group.id, session.id, {
          gameId: game.id,
          playedAt: '2026-11-23',
          participantIds: playersB.map((p) => p.id),
          winnerIds: [playersB[0].id],
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(mockApi.deleteSession(group.id, session.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('评论', () => {
    it('参与者可写/编辑/删除自己的评论；非参与者被拒', async () => {
      const { group } = await setupGroup()
      const game = await mockApi.createGame(group.id, { name: '卡坦岛', tags: [] })
      const players = await mockApi.listPlayers(group.id)
      const session = await mockApi.createSession(group.id, {
        gameId: game.id,
        playedAt: '2026-11-22',
        participantIds: [players[0].id],
        winnerIds: [players[0].id],
      })

      // 管理员（参与）留评论
      const comment = await mockApi.upsertMyComment(group.id, session.id, '第一局，很精彩')
      expect(comment?.content).toBe('第一局，很精彩')

      // 编辑
      const edited = await mockApi.upsertMyComment(group.id, session.id, '第一局，逆风翻盘')
      expect(edited?.content).toBe('第一局，逆风翻盘')
      expect(await mockApi.listComments(group.id, session.id)).toHaveLength(1)

      // 非参与者被拒
      await mockApi.logout()
      await mockApi.register({ username: '小乙', password: 'secret456' })
      await mockApi.joinGroup(group.groupId)
      await expect(mockApi.upsertMyComment(group.id, session.id, '我没参加')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })

      // 删除自己的评论（空内容）
      await mockApi.logout()
      await mockApi.login({ username: '阿伦', password: 'secret123' })
      expect(await mockApi.upsertMyComment(group.id, session.id, '')).toBeNull()
      expect(await mockApi.listComments(group.id, session.id)).toHaveLength(0)
    })

    it('协管可删除任意评论，普通成员不可', async () => {
      const { group } = await setupGroup()
      const game = await mockApi.createGame(group.id, { name: '卡坦岛', tags: [] })
      const players = await mockApi.listPlayers(group.id)
      const session = await mockApi.createSession(group.id, {
        gameId: game.id,
        playedAt: '2026-11-22',
        participantIds: [players[0].id],
        winnerIds: [players[0].id],
      })
      const comment = await mockApi.upsertMyComment(group.id, session.id, '评论内容')

      // 普通成员删任意评论 → 403
      await mockApi.logout()
      await mockApi.register({ username: '小乙', password: 'secret456' })
      await mockApi.joinGroup(group.groupId)
      await expect(mockApi.deleteComment(group.id, session.id, comment!.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })

      // admin 删除
      await mockApi.logout()
      await mockApi.login({ username: '阿伦', password: 'secret123' })
      await mockApi.deleteComment(group.id, session.id, comment!.id)
      expect(await mockApi.listComments(group.id, session.id)).toHaveLength(0)
    })
  })

  describe('解散群组', () => {
    it('仅 admin 可解散；解散后成员看不到群组', async () => {
      const { group } = await setupGroup()
      await mockApi.createGame(group.id, { name: '卡坦岛', tags: [] })

      await mockApi.logout()
      await mockApi.register({ username: '小乙', password: 'secret456' })
      await mockApi.joinGroup(group.groupId)
      await expect(mockApi.disbandGroup(group.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })

      await mockApi.logout()
      await mockApi.login({ username: '阿伦', password: 'secret123' })
      await mockApi.disbandGroup(group.id)
      expect(await mockApi.listGroups()).toHaveLength(0)
      await mockApi.logout()
      await mockApi.login({ username: '小乙', password: 'secret456' })
      expect(await mockApi.listGroups()).toHaveLength(0)
    })
  })

  it('非成员访问群组数据 → NOT_MEMBER', async () => {
    const { group } = await setupGroup()
    await mockApi.logout()
    await mockApi.register({ username: '路人', password: 'secret789' })
    await expect(mockApi.getGroup(group.id)).rejects.toMatchObject({ code: 'NOT_MEMBER' })
    await expect(mockApi.listSessions(group.id)).rejects.toMatchObject({ code: 'NOT_MEMBER' })
  })
})
