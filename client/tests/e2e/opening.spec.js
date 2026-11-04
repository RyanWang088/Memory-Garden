import { test, expect } from '@playwright/test';

const EMAIL = 'demo@smu.edu.sg'
const PASSWORD = 'demo@smu.edu.sg'

const NAME_ERROR = 'Please enter a name to continue.'

let account = null

// sign-up plus the afterEach clean-up can take longer than Playwright's default 30s per test
test.describe.configure({ timeout: 60000 });

async function logIn(page, email, password) {
  await page.goto('/');
  await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click();
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(password);
  await page.getByTestId('auth-submit').click();
}

async function signUp(page) {
  account = { email: `e2e-${Date.now()}@example.com`, password: 'FirstPassword1!' }
  await page.goto('/auth?mode=signup');
  await page.getByTestId('auth-email').fill(account.email);
  await page.getByTestId('auth-password').fill(account.password);
  await page.getByTestId('auth-submit').click();
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 }); // sign-up is slow: several requests, then a 1.2s pause
}

async function finishOnboarding(page) {
  for (let step = 0; step < 5; step++) {
    await page.getByTestId('onboarding-next').click();
  }
  await page.getByTestId('onboarding-name').fill('Test Gardener');
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-finish').click();
  await expect(page).toHaveURL(/\/garden/);
}

async function goToAboutYou(page) {
  for (let step = 0; step < 5; step++) {
    await page.getByTestId('onboarding-next').click();
  }
  await expect(page.getByTestId('onboarding-name')).toBeVisible();
}

test.afterEach(async ({ page }) => {
  if (!account) return
  await page.goto('/profile');
  await expect(page.getByTestId('auth-email').or(page.getByTestId('settings-delete'))).toBeVisible();
  if (await page.getByTestId('auth-email').isVisible()) {
    await page.getByTestId('auth-email').fill(account.email);
    await page.getByTestId('auth-password').fill(account.password);
    await page.getByTestId('auth-submit').click();
  }
  await page.getByTestId('settings-delete').click();
  await page.getByTestId('delete-password').fill(account.password);
  await page.getByTestId('delete-typed').fill('DELETE');
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByTestId('start-growing')).toBeVisible({ timeout: 15000 });
  account = null
});

test('Test 1: Log in with valid credentials (returning users)', async ({ page }) => {
  await logIn(page, EMAIL, PASSWORD);

  // returning users go straight to their garden, not onboarding
  await expect(page).toHaveURL(/\/garden/);
  await expect(page.getByTestId('garden-stage')).toBeVisible();
});

test('Test 2: should show an error for a wrong password', async ({ page }) => {
  await logIn(page, EMAIL, 'not-the-right-password');

  await expect(page.getByTestId('auth-status')).toHaveText('Wrong email or password.');
  await expect(page).toHaveURL(/\/auth/);
});

test('Test 3: Create account, sign up and finish onboarding', async ({ page }) => {
  await signUp(page);
  await finishOnboarding(page);
  await expect(page.getByTestId('garden-stage')).toBeVisible();

  // onboarding was saved: it can't be opened again
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/garden/);
});

test('Test 4: should log out and return to about Sproutly page', async ({ page }) => {
  await logIn(page, EMAIL, PASSWORD);
  await expect(page).toHaveURL(/\/garden/);

  await page.getByRole('link', { name: 'Profile' }).click();
  await page.getByTestId('logout').click();

  await expect(page.getByTestId('start-growing')).toBeVisible();
  await expect(page).toHaveURL('/');

  await page.goto('/garden');
  await expect(page).toHaveURL(/\/auth/);
});

test('Test 5: name is required to move past About you', async ({ page }) => {
  await signUp(page);
  await goToAboutYou(page);

  await page.getByTestId('onboarding-next').click();

  await expect(page.getByText(NAME_ERROR)).toBeVisible();
  await expect(page.getByTestId('onboarding-name')).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding/);
});

test('Test 6: Skip tour without a name goes to About you', async ({ page }) => {
  await signUp(page);

  await page.getByTestId('onboarding-skip').click();

  await expect(page.getByTestId('onboarding-name')).toBeVisible();
  await expect(page.getByText(NAME_ERROR)).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding/);
});

test('Test 7: Skip tour with a name goes to the garden', async ({ page }) => {
  await signUp(page);
  await goToAboutYou(page);
  await page.getByTestId('onboarding-name').fill('Test Gardener');

  await page.getByTestId('onboarding-skip').click();

  await expect(page).toHaveURL(/\/garden/);
  await expect(page.getByTestId('garden-stage')).toBeVisible();
});

test('Test 8: a name of only spaces does not count', async ({ page }) => {
  await signUp(page);
  await goToAboutYou(page);
  await page.getByTestId('onboarding-name').fill('   ');

  await page.getByTestId('onboarding-next').click();

  await expect(page.getByText(NAME_ERROR)).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding/);
});

test('Test 9: logged-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/onboarding');

  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByTestId('auth-email')).toBeVisible();
});
