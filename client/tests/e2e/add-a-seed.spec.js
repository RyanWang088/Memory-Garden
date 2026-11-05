import { test, expect } from '@playwright/test';

const EMAIL = 'demo@smu.edu.sg'
const PASSWORD = 'demo@smu.edu.sg'

test('Can navigate to add a seed', async ({ page }) => {
   await page.route('*/**/api/seeds', route => route.fulfill({ json: [{
        "id": "d8f12284-a12b-4178-9442-4dcb78e73c5a",
        "user_id": "3d3bd70b-04b6-4efe-b282-8ee5bcae7e4f",
        "subject_id": "c1c9a0a4-89a9-4aa2-a3c0-605bedabea01",
        "title": "test1",
        "tags": [
            {
                "name": "test1",
                "color": "peri"
            }
        ],
        "row": 11,
        "col": 1,
        "flower": "tulip",
        "last_reviewed": null,
        "created_at": "2026-10-15T10:39:11.077577+00:00",
        "color": "pink",
        "in_house": false,
        "exam_id": null,
        "subject": "tset1",
        "shelf_slot": null,
        "exam_name": null,
        "exam_date": null,
        "exam_choice": null,
        "cards": [
            {
                "id": "885b9198-2a39-4640-9e22-fef24b6155f8",
                "answer": "t",
                "question": "t",
                "next_review": null,
                "card_mastery": 0,
                "wrong_options": []
            }
        ],
        "mastery": 0,
        "priority": 0.15,
        "alert": false
    },] }))
  await page.goto('http://localhost:5173/');
  await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click();
  await page.getByTestId('auth-email').click();
  await page.getByTestId('auth-email').fill(EMAIL);
  await page.getByTestId('auth-password').click();
  await page.getByTestId('auth-password').fill(PASSWORD);
  const seedsLoaded = page.waitForResponse('/api/seeds'); 
  await page.getByTestId('auth-submit').click();
  await seedsLoaded; 
  await page.getByTestId('shed-tab-seeds').click();
  await page.getByTestId('seed-tulip').click();
  await page.getByTestId('seed-tulip').hover();
  await page.mouse.down();
  await page.getByTestId('meadow').hover();
  await page.getByTestId('meadow').hover();
  await page.mouse.up();
  await expect(page.locator('section').filter({ hasText: 'Plant a new seedIt will grow' })).toBeVisible();
});
test('Can enter items into add a seed', async({page})=>{
  await page.route('*/**/api/seeds', route => route.fulfill({ json: [{
        "id": "d8f12284-a12b-4178-9442-4dcb78e73c5a",
        "user_id": "3d3bd70b-04b6-4efe-b282-8ee5bcae7e4f",
        "subject_id": "c1c9a0a4-89a9-4aa2-a3c0-605bedabea01",
        "title": "test1",
        "tags": [
            {
                "name": "test1",
                "color": "peri"
            }
        ],
        "row": 11,
        "col": 1,
        "flower": "tulip",
        "last_reviewed": null,
        "created_at": "2026-10-15T10:39:11.077577+00:00",
        "color": "pink",
        "in_house": false,
        "exam_id": null,
        "subject": "tset1",
        "shelf_slot": null,
        "exam_name": null,
        "exam_date": null,
        "exam_choice": null,
        "cards": [
            {
                "id": "885b9198-2a39-4640-9e22-fef24b6155f8",
                "answer": "t",
                "question": "t",
                "next_review": null,
                "card_mastery": 0,
                "wrong_options": []
            }
        ],
        "mastery": 0,
        "priority": 0.15,
        "alert": false
    },] }))
  await page.goto('http://localhost:5173/');
  await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click();
  await page.getByTestId('auth-email').click();
  await page.getByTestId('auth-email').fill(EMAIL);
  await page.getByTestId('auth-password').click();
  await page.getByTestId('auth-password').fill(PASSWORD);
  const seedsLoaded = page.waitForResponse('/api/seeds'); 
  await page.getByTestId('auth-submit').click();
  await seedsLoaded; 
  await page.getByTestId('shed-tab-seeds').click();
  await page.getByTestId('seed-tulip').click();
  await page.getByTestId('seed-tulip').hover();
  await page.mouse.down();
  await page.getByTestId('meadow').hover();
  await page.getByTestId('meadow').hover();
  await page.mouse.up();
  await page.getByTestId('seed-title').click();
  await page.getByTestId('seed-title').fill('test1');
  await page.getByTestId('seed-subject').click();
  await page.getByTestId('seed-subject').fill('test1');
  await page.getByTestId('seed-exam-name').click();
  await page.getByTestId('seed-exam-name').fill('');
  await page.getByTestId('seed-tag-input').click();
  await page.getByTestId('seed-tag-input').fill('test1');
  await page.getByTestId('source-upload').click();
  await page.getByTestId('source-builder').click();
  await page.getByTestId('card-question').click();
  await page.getByTestId('card-question').fill('test1');
  await page.getByTestId('card-answer').click();
  await page.getByTestId('card-answer').fill('test1');
  await page.getByTestId('card-add').click();
  await page.getByTestId('seed-save').click();
  await expect(page.getByTestId('plant-seed-form')).toBeHidden();
})