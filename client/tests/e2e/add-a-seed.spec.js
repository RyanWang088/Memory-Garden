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
  
});