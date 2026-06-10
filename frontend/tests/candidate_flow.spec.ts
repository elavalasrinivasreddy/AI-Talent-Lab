import { test, expect } from '@playwright/test';

test.describe('Candidate Magic Link Flow', () => {
  test('Candidate can request a magic link from the apply page', async ({ page }) => {
    // Navigate to the apply page (assuming /apply is the public apply route)
    await page.goto('/apply');
    
    // Expect the heading to be visible
    await expect(page.locator('h1')).toContainText('Apply');
    
    // Fill in candidate email
    await page.fill('input[type="email"]', 'candidate@example.com');
    
    // Click submit
    await page.click('button[type="submit"]');
    
    // Expect success message
    await expect(page.locator('text=Check your inbox')).toBeVisible();
  });
});
