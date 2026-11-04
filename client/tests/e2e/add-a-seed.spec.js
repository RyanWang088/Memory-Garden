import { test, expect } from '@playwright/test';

const EMAIL = 'demo@smu.edu.sg'
const PASSWORD = 'demo@smu.edu.sg'

test('Can navigate to add a seed', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click();
  await page.getByTestId('auth-email').click();
  await page.getByTestId('auth-email').fill(EMAIL);
  await page.getByTestId('auth-password').click();
  await page.getByTestId('auth-password').fill(PASSWORD);
  await page.getByTestId('auth-submit').click();
  await page.getByTestId('shed-tab-seeds').click();
  await page.getByTestId('seed-tulip').click();
  await page.getByTestId('seed-tulip').hover();
  await page.mouse.down();
  await page.getByTestId('meadow').hover();
  await page.getByTestId('meadow').hover();
  await page.mouse.up();
  await expect(page.locator('section').filter({ hasText: 'Plant a new seedIt will grow' })).toBeVisible();
});