import { expect, test } from '@playwright/test'

const uniqueName = (prefix: string) => `${prefix}${Math.floor(Math.random() * 1_000_000)}`

test('用户菜单：查看用户 ID、修改密码、用新密码登录', async ({ page }) => {
  const name = uniqueName('改密')

  // 注册并进入大厅
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: '注册开桌' })).toBeVisible()
  await page.getByLabel('用户名').fill(name)
  await page.getByLabel('密码').fill('secret123')
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  // 打开用户菜单，查看用户 ID
  await page.locator('header').getByRole('button', { name: new RegExp(name) }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page.getByText('用户 ID')).toBeVisible()
  const userId = (await page.locator('code').innerText()).trim()
  expect(userId.length).toBeGreaterThan(0)

  // 修改密码：先输错当前密码 → 报错
  await page.getByRole('menuitem', { name: '修改密码' }).click()
  await expect(page.getByRole('dialog', { name: '修改密码' })).toBeVisible()
  await page.getByLabel('当前密码', { exact: true }).fill('wrong-pass')
  await page.getByLabel('新密码', { exact: true }).fill('newsecret1')
  await page.getByLabel('确认新密码', { exact: true }).fill('newsecret1')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(/当前密码不正确/)

  // 输入正确的当前密码 → 修改成功
  await page.getByLabel('当前密码', { exact: true }).fill('secret123')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('密码已修改')).toBeVisible()
  await page.getByRole('button', { name: '完成' }).click()

  // 退出，旧密码登录失败、新密码成功
  await page.locator('header').getByRole('button', { name: new RegExp(name) }).click()
  await page.getByRole('menuitem', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('用户名').fill(name)
  await page.getByLabel('密码').fill('secret123')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(/用户名或密码不正确/)
  await page.getByLabel('密码').fill('newsecret1')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})
