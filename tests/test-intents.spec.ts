import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Intent Section Visibility', () => {
  test('should show intent section in WLED module', async ({ page }) => {
    await page.goto(`${BASE_URL}/modules/wled`);
    await page.waitForLoadState('networkidle');
    
    // Look for intent reactions section
    const intentSection = page.locator('text=Intent Reactions').or(page.locator('text=Intent-Reaktionen'));
    await expect(intentSection).toBeVisible({ timeout: 10000 });
  });

  test('should show intent section in Darts Caller module', async ({ page }) => {
    await page.goto(`${BASE_URL}/modules/darts-caller`);
    await page.waitForLoadState('networkidle');
    
    const intentSection = page.locator('text=Intent Reactions').or(page.locator('text=Intent-Reaktionen'));
    await expect(intentSection).toBeVisible({ timeout: 10000 });
  });

  test('should show intent section in Game Display module', async ({ page }) => {
    await page.goto(`${BASE_URL}/modules/game-display`);
    await page.waitForLoadState('networkidle');

    const intentSection = page.locator('text=Intent Reactions').or(page.locator('text=Intent-Reaktionen'));
    await expect(intentSection).toBeVisible({ timeout: 10000 });
  });
});
