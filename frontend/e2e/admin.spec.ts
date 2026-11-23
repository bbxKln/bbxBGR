import { expect, test } from '@playwright/test'

const uniqueName = (prefix: string) => `${prefix}${Math.floor(Math.random() * 1_000_000)}`

test('运营后台：未登录显示登录表单，运营账号登录后看到指标', async ({ page }) => {
  // 未登录访问 /admin → 登录表单
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: '运营后台' })).toBeVisible()
  await expect(page.getByLabel('运营账号')).toBeVisible()

  // 运营账号登录（本地 D1 已初始化）
  await page.getByLabel('运营账号').fill('运营')
  await page.getByLabel('密码').fill('operator123456')
  await page.getByRole('button', { name: '登录', exact: true }).click()

  await expect(page.getByText('总用户数')).toBeVisible()
  await expect(page.getByText('总群组数')).toBeVisible()
  await expect(page.getByText('总场次数')).toBeVisible()
  await expect(page.getByRole('heading', { name: '场次纪录' })).toBeVisible()

  // 退出回到登录表单
  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page.getByRole('heading', { name: '运营后台' })).toBeVisible()
})

test('普通用户访问 /admin 显示 404', async ({ page }) => {
  // 注册普通用户（已登录状态）
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: '注册开桌' })).toBeVisible()
  await page.getByLabel('用户名').fill(uniqueName('路人'))
  await page.getByLabel('密码').fill('secret123')
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  // 已登录的普通用户访问 /admin → 404
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible()
})

test('运营账号错误密码被拒绝', async ({ page }) => {
  await page.goto('/admin')
  await page.getByLabel('运营账号').fill('运营')
  await page.getByLabel('密码').fill('wrong-password')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(/用户名或密码不正确/)
})
