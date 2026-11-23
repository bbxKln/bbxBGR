import { expect, test, type Page } from '@playwright/test'

const uniqueName = (prefix: string) => `${prefix}${Math.floor(Math.random() * 1_000_000)}`

/**
 * SPA 导航是异步的（React Router v7 在 transition 中提交路由），
 * URL 变化不等于页面渲染完成。等待目标页面独有的标题出现后再交互。
 */
async function waitForPage(page: Page, heading: string) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
}

/** 退出登录：先打开右上角用户菜单 */
async function logout(page: Page, username: string) {
  await page.locator('header').getByRole('button', { name: new RegExp(username) }).click()
  await page.getByRole('menuitem', { name: '退出登录' }).click()
}

test.describe.configure({ mode: 'serial' })

test('注册 → 创建群组 → 换账号凭群组 ID 加入', async ({ page }) => {
  const nameA = uniqueName('阿伦')

  // 未登录访问首页 → 跳到登录页
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await waitForPage(page, '开桌')

  // 注册第一个用户
  await page.getByRole('link', { name: '注册一个' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await waitForPage(page, '注册开桌')
  await page.getByLabel('用户名').fill(nameA)
  await page.getByLabel('密码').fill('secret123')
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('还没有群组')).toBeVisible()

  // 创建群组，记录 8 位群组 ID
  await page.getByRole('button', { name: '创建群组' }).first().click()
  await page.getByLabel('群组名称').fill('周五桌游夜')
  await page.getByRole('button', { name: '创建', exact: true }).click()
  await expect(page.getByText('群组已创建')).toBeVisible()
  const groupId = (await page.locator('code').innerText()).trim()
  expect(groupId).toMatch(/^[1-9]\d{7}$/)
  await page.getByRole('button', { name: '完成' }).click()
  await expect(page.getByText('周五桌游夜')).toBeVisible()

  // 退出，注册第二个用户
  await logout(page, nameA)
  await expect(page).toHaveURL(/\/login$/)
  await waitForPage(page, '开桌')
  await page.getByRole('link', { name: '注册一个' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await waitForPage(page, '注册开桌')
  await page.getByLabel('用户名').fill(uniqueName('小乙'))
  await page.getByLabel('密码').fill('secret123')
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  // 凭群组 ID 加入
  await page.locator('main').getByRole('button', { name: '按群组 ID 加入' }).first().click()
  await page.getByLabel('群组 ID').fill(groupId)
  await page.getByRole('button', { name: '加入', exact: true }).click()
  await expect(page.getByText('已加入群组')).toBeVisible()
  await page.getByRole('button', { name: '完成' }).click()
  await expect(page.getByText('周五桌游夜')).toBeVisible()

  // 加入一个不存在的 ID → 提示错误
  await page.locator('main').getByRole('button', { name: '按群组 ID 加入' }).first().click()
  await page.getByLabel('群组 ID').fill('99999999')
  await page.getByRole('button', { name: '加入', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(/群组不存在/)
})

test('重复用户名与错误密码被拒绝', async ({ page }) => {
  const name = uniqueName('重名')

  await page.goto('/register')
  await waitForPage(page, '注册开桌')
  await page.getByLabel('用户名').fill(name)
  await page.getByLabel('密码').fill('secret123')
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  // 退出后用同一用户名注册 → 报错
  await logout(page, name)
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/register')
  await waitForPage(page, '注册开桌')
  await page.getByLabel('用户名').fill(name)
  await page.getByLabel('密码').fill('secret456')
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(/用户名已存在/)

  // 错误密码登录 → 报错
  await page.goto('/login')
  await waitForPage(page, '开桌')
  await page.getByLabel('用户名').fill(name)
  await page.getByLabel('密码').fill('wrong-pass')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(/用户名或密码不正确/)
})
