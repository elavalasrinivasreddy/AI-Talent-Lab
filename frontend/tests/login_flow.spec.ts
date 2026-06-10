import { test, expect } from '@playwright/test';

test.describe('Login & Dashboard Flow', () => {
  test('User can login and see the dashboard', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    
    // Expect the login form to be visible
    await expect(page.locator('h1')).toContainText('Hire is a verb');
    
    // Fill credentials
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Expect to be redirected to dashboard
    // We might need to wait for navigation or expect URL
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Expect Dashboard title or element
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('User can navigate to hire requests', async ({ page }) => {
    // We assume the user is logged in, or we do a quick login.
    // For a real E2E, we'd use a global setup or login in beforeEach
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // Click on Hire Requests in sidebar
    await page.click('a:has-text("Hire Requests")');
    
    // Expect URL and Title
    await expect(page).toHaveURL(/.*\/hire-requests/);
    await expect(page.locator('h1')).toContainText('Hire Requests');
  });
});
