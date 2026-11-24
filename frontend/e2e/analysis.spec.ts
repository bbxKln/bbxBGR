import { expect, test } from '@playwright/test'

const uniqueName = (prefix: string) => `${prefix}${Math.floor(Math.random() * 1_000_000)}`

test('M3 分析页：胜率计算、趋势、矩阵与筛选', async ({ page }) => {
  const nameA = uniqueName('阿伦')

  // 注册并建群
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: '注册开桌' })).toBeVisible()
  await page.getByLabel('用户名').fill(nameA)
  await page.getByLabel('密码').fill('secret123')
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', { name: '创建群组' }).first().click()
  await page.getByLabel('群组名称').fill('分析局')
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.getByText('群组已创建')).toBeVisible()
  await page.getByRole('button', { name: '完成' }).click()
  await page.getByRole('link', { name: /分析局/ }).click()
  await expect(page.getByRole('heading', { name: '分析局' })).toBeVisible()

  // 两个桌游（带标签）：卡坦岛手动输入，阿瓦隆点选已有标签
  await page.getByRole('tab', { name: '桌游' }).click()
  await page.getByRole('button', { name: '新增桌游' }).click()
  await page.getByLabel('名称').fill('卡坦岛')
  const tagInput = page.locator('#game-tags')
  await tagInput.fill('策略')
  await tagInput.press('Enter')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('button', { name: '新增桌游' }).click()
  await page.getByLabel('名称').fill('阿瓦隆')
  // 手动输入一个，再点选已有标签「策略」
  await tagInput.fill('聚会')
  await tagInput.press('Enter')
  await expect(page.getByText('已有标签（点击添加）')).toBeVisible()
  await page.getByRole('button', { name: '添加已有标签 策略' }).click()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const avalonCard = page.locator('li').filter({ hasText: '阿瓦隆' })
  await expect(avalonCard.getByText('策略')).toBeVisible()
  await expect(avalonCard.getByText('聚会')).toBeVisible()

  // 无名玩家
  await page.getByRole('tab', { name: '玩家' }).click()
  await page.getByRole('button', { name: '新增玩家' }).click()
  await page.getByLabel('姓名').fill('无名')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  // 两场：S1 卡坦岛 1月 双赢；S2 阿瓦隆 2月 无名独赢
  await page.getByRole('tab', { name: '场次' }).click()
  const createSession = async (gameName: string, date: string, winners: string[]) => {
    await page.getByRole('button', { name: '新增场次' }).click()
    await page.getByLabel('桌游').selectOption({ label: gameName })
    await page.getByLabel('游玩时间').fill(date)
    const form = page.locator('form')
    await form.getByRole('button', { name: nameA }).first().click()
    await form.getByRole('button', { name: '无名' }).first().click()
    for (const winner of winners) {
      await form.getByRole('button', { name: winner }).nth(1).click()
    }
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }
  await createSession('卡坦岛', '2026-01-10', [nameA, '无名'])
  await createSession('阿瓦隆', '2026-02-15', ['无名'])

  // ===== 分析页 =====
  await page.getByRole('tab', { name: '分析' }).click()

  // 汇总（胜率降序）：无名 100% 排在阿伦 50% 前面
  const summaryTable = page.locator('table').first()
  const summaryRows = summaryTable.locator('tbody tr')
  await expect(summaryRows).toHaveCount(2)
  await expect(summaryRows.nth(0)).toContainText('无名')
  await expect(summaryRows.nth(0).getByText('100%', { exact: true })).toBeVisible()
  const rowA = summaryTable.locator('tr').filter({ hasText: nameA })
  await expect(rowA.getByText('50%', { exact: true })).toBeVisible()

  // 趋势折线图渲染，含两个月份刻度
  await expect(page.getByRole('img', { name: '按月胜率趋势折线图' })).toBeVisible()
  await expect(page.locator('svg').filter({ hasText: '1月' })).toHaveCount(1)
  await expect(page.locator('svg').filter({ hasText: '2月' })).toHaveCount(1)

  // 筛选：只看卡坦岛
  await page.getByRole('button', { name: /桌游/ }).click()
  await page.getByRole('checkbox', { name: '卡坦岛' }).click()
  await page.keyboard.press('Escape') // 关闭下拉
  await expect(rowA.getByText('100%', { exact: true })).toBeVisible()
  // 折线图 y 轴含「50%」刻度，因此只断言汇总表
  await expect(summaryTable.getByText('50%', { exact: true })).toHaveCount(0)

  // 重置筛选
  await page.getByRole('button', { name: '重置筛选' }).click()
  await expect(rowA.getByText('50%', { exact: true })).toBeVisible()

  // ===== 桌游页：展开卡坦岛看各玩家胜率 =====
  // S1 卡坦岛双赢 → 阿伦 100%（1/1）、无名 100%（1/1），并列按玩家列表顺序（阿伦在前）
  await page.getByRole('tab', { name: '桌游' }).click()
  await page.getByRole('button', { name: '查看卡坦岛胜率' }).click()
  const gameCard = page.locator('li').filter({ hasText: '卡坦岛' })
  await expect(gameCard.getByText('各玩家胜率')).toBeVisible()
  const gameBars = gameCard.getByRole('listitem')
  await expect(gameBars).toHaveCount(2)
  await expect(gameBars.nth(0)).toContainText(nameA)
  await expect(gameBars.nth(0)).toContainText('100% · 1/1')
  await expect(gameBars.nth(1)).toContainText('无名')
  await expect(gameBars.nth(1)).toContainText('100% · 1/1')

  // ===== 玩家页：展开无名看各桌游胜率（降序）=====
  // 无名两局全胜 → 阿瓦隆 100%（1/1）、卡坦岛 100%（1/1），并列按场次排序（阿瓦隆在前）
  await page.getByRole('tab', { name: '玩家' }).click()
  await page.getByRole('button', { name: '查看无名胜率' }).click()
  const playerCard = page.locator('li').filter({ hasText: '账号' }).filter({ hasText: '无名' })
  await expect(playerCard.getByText('各桌游胜率')).toBeVisible()
  const playerBars = playerCard.getByRole('listitem')
  await expect(playerBars).toHaveCount(2)
  await expect(playerBars.nth(0)).toContainText('阿瓦隆')
  await expect(playerBars.nth(0)).toContainText('100% · 1/1')
  await expect(playerBars.nth(1)).toContainText('卡坦岛')
  await expect(playerBars.nth(1)).toContainText('100% · 1/1')

  // ===== 玩家页：展开阿伦看各桌游胜率（降序：卡坦岛 100% > 阿瓦隆 0%）=====
  await page.getByRole('button', { name: `查看${nameA}胜率` }).click()
  const cardA = page.locator('li').filter({ hasText: '账号' }).filter({ hasText: nameA })
  const barsA = cardA.getByRole('listitem')
  await expect(barsA.nth(0)).toContainText('卡坦岛')
  await expect(barsA.nth(0)).toContainText('100% · 1/1')
  await expect(barsA.nth(1)).toContainText('阿瓦隆')
  await expect(barsA.nth(1)).toContainText('0% · 0/1')
})
