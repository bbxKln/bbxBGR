import { expect, test, type Page } from '@playwright/test'

const uniqueName = (prefix: string) => `${prefix}${Math.floor(Math.random() * 1_000_000)}`

async function waitForPage(page: Page, heading: string) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
}

async function register(page: Page, username: string) {
  await page.goto('/register')
  await waitForPage(page, '注册开桌')
  await page.getByLabel('用户名').fill(username)
  await page.getByLabel('密码').fill('secret123')
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

test.describe.configure({ mode: 'serial' })

test('M2 全流程：桌游/玩家/场次/评论/权限/软删除', async ({ page }) => {
  const nameA = uniqueName('阿伦')
  const nameB = uniqueName('小乙')

  // ===== 管理员 A：建群 =====
  await register(page, nameA)
  await page.getByRole('button', { name: '创建群组' }).first().click()
  await page.getByLabel('群组名称').fill('周五桌游夜')
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.getByText('群组已创建')).toBeVisible()
  const groupId = (await page.locator('code').innerText()).trim()
  await page.getByRole('button', { name: '完成' }).click()
  await page.getByRole('link', { name: /周五桌游夜/ }).click()

  // 群组页：标题、管理员徽标、三个 tab
  await expect(page.getByRole('heading', { name: '周五桌游夜' })).toBeVisible()
  await expect(page.getByText('管理员')).toBeVisible()
  await expect(page.getByRole('tab', { name: '场次' })).toBeVisible()

  // ===== 玩家：新增无名 =====
  await page.getByRole('tab', { name: '玩家' }).click()
  await expect(page.locator('code').filter({ hasText: groupId })).toBeVisible() // 群组 ID 仅 admin 可见
  await page.getByRole('button', { name: '新增玩家' }).click()
  await page.getByLabel('姓名').fill('无名')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('未关联账号')).toBeVisible()

  // ===== 桌游：新增卡坦岛（带标签）=====
  await page.getByRole('tab', { name: '桌游' }).click()
  await page.getByRole('button', { name: '新增桌游' }).click()
  await page.getByLabel('名称').fill('卡坦岛')
  const tagInput = page.locator('#game-tags')
  await tagInput.fill('策略')
  await tagInput.press('Enter')
  await tagInput.fill('经营')
  await tagInput.press('Enter')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('卡坦岛')).toBeVisible()
  await expect(page.getByText('策略')).toBeVisible()

  // ===== 场次：卡坦岛，A + 无名参与，双赢，MVP 无名 =====
  await page.getByRole('tab', { name: '场次' }).click()
  await page.getByRole('button', { name: '新增场次' }).click()
  await page.getByLabel('桌游').selectOption({ label: '卡坦岛' })
  const form = page.locator('form')
  await form.getByRole('button', { name: nameA }).first().click() // 参与：阿伦
  await form.getByRole('button', { name: '无名' }).first().click() // 参与：无名
  await form.getByRole('button', { name: nameA }).nth(1).click() // 获胜：阿伦
  await form.getByRole('button', { name: '无名' }).nth(1).click() // 获胜：无名
  await page.getByLabel('MVP').selectOption({ label: '无名' })
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('赢：')).toBeVisible()
  await expect(page.getByText(`赢：${nameA}、无名`)).toBeVisible()

  // ===== A 打开场次详情，留评论 =====
  await page.getByRole('button', { name: /卡坦岛/ }).click()
  await expect(page.getByText('参与玩家（2）')).toBeVisible()
  await page.getByLabel('我的评论').fill('第一局，大家都很稳')
  await page.getByRole('button', { name: '保存评论' }).click()
  await expect(page.getByText('第一局，大家都很稳')).toBeVisible()
  await page.getByRole('button', { name: '关闭' }).click()

  // ===== B 注册并凭 ID 加入 =====
  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await register(page, nameB)
  await page.locator('main').getByRole('button', { name: '按群组 ID 加入' }).click()
  await page.getByLabel('群组 ID').fill(groupId)
  await page.getByRole('button', { name: '加入', exact: true }).click()
  await page.getByRole('button', { name: '完成' }).click()
  await page.getByRole('link', { name: /周五桌游夜/ }).click()

  // B 是普通成员：看不到管理员徽标与群组 ID，桌游页没有新增按钮
  await expect(page.getByRole('heading', { name: '周五桌游夜' })).toBeVisible()
  await expect(page.getByText('管理员')).not.toBeVisible()
  await page.getByRole('tab', { name: '玩家' }).click()
  await expect(page.locator('code').filter({ hasText: groupId })).not.toBeVisible()
  await page.getByRole('tab', { name: '桌游' }).click()
  await expect(page.getByRole('button', { name: '新增桌游' })).not.toBeVisible()

  // B 创建自己的场次并评论
  await page.getByRole('tab', { name: '场次' }).click()
  await page.getByRole('button', { name: '新增场次' }).click()
  await page.getByLabel('桌游').selectOption({ label: '卡坦岛' })
  const formB = page.locator('form')
  await formB.getByRole('button', { name: nameB }).first().click() // 参与：B
  await formB.getByRole('button', { name: '无名' }).first().click() // 参与：无名
  await formB.getByRole('button', { name: nameB }).nth(1).click() // 获胜：B
  await page.getByLabel('MVP').selectOption({ label: nameB })
  await page.getByRole('button', { name: '保存', exact: true }).click()
  // 先等表单弹窗关闭，再等 B 的场次卡片出现在列表里（避免点到 A 的场次）
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: new RegExp(nameB) })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(nameB) }).click()
  await page.getByLabel('我的评论').fill('B 的评论')
  await page.getByRole('button', { name: '保存评论' }).click()
  await expect(page.getByText('B 的评论')).toBeVisible()
  await page.getByRole('button', { name: '关闭' }).click()

  // ===== A 回来：删除 B 的评论、给 B 设协管、软删除桌游 =====
  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/login')
  await waitForPage(page, '开桌')
  await page.getByLabel('用户名').fill(nameA)
  await page.getByLabel('密码').fill('secret123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.getByRole('link', { name: /周五桌游夜/ }).click()

  // 打开 B 的场次（最新在前），删除 B 的评论
  await page.getByRole('button', { name: /卡坦岛/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByText('B 的评论')).not.toBeVisible()
  await page.getByRole('button', { name: '关闭' }).click()

  // 给 B 设为协管
  await page.getByRole('tab', { name: '玩家' }).click()
  const bRow = page.locator('li').filter({ hasText: `账号：${nameB}` })
  await bRow.getByRole('button', { name: '设为协管' }).click()
  await expect(bRow.getByText('协管')).toBeVisible()

  // 软删除卡坦岛：提示历史场次，删除后场次仍显示桌游名
  await page.getByRole('tab', { name: '桌游' }).click()
  await page.getByRole('button', { name: '删除', exact: true }).click()
  const confirm = page.getByRole('dialog')
  await expect(confirm.getByText(/历史场次/)).toBeVisible()
  await confirm.getByRole('button', { name: '删除', exact: true }).click()
  // 等确认弹窗关闭、列表刷新后，桌游页不再显示卡坦岛
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('卡坦岛', { exact: true })).not.toBeVisible()

  await page.getByRole('tab', { name: '场次' }).click()
  await expect(page.getByRole('button', { name: /卡坦岛/ }).first()).toBeVisible()
})
