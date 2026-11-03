import { test, expect } from '@playwright/test';

const EMAIL = 'demo@smu.edu.sg'
const PASSWORD = 'demo@smu.edu.sg'

test('Can navigate to journal to-do', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click();
  await page.getByTestId('auth-email').click();
  await page.getByTestId('auth-email').fill(EMAIL);
  await page.getByTestId('auth-password').click();
  await page.getByTestId('auth-password').fill(PASSWORD);
  await page.getByTestId('auth-submit').click();
  await page.getByTestId('nav-planner').click();
  await expect(page.getByRole('region', { name: 'To-do list' }).getByText('To-do')).toBeVisible();
});

test('Can enter item into journal',async ({page})=>{
await page.goto('http://localhost:5173/');
await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click();
await page.getByTestId('auth-email').click();
await page.getByTestId('auth-email').fill(EMAIL);
await page.getByTestId('auth-password').click();
await page.getByTestId('auth-password').fill(PASSWORD);
await page.getByTestId('auth-submit').click();
await page.getByTestId('nav-planner').click();
await page.getByTestId('planner-new-task').click();
await page.getByTestId('planner-new-task').fill('test1');
await page.getByTestId('planner-add').click();
await page.goto('/planner')
await expect(page.getByTestId('planner-task')).toContainText('test1');
});
