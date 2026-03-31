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

  test('should show intent section in Player Analytics module', async ({ page }) => {
    await page.goto(`${BASE_URL}/modules/player-analytics`);
    await page.waitForLoadState('networkidle');
    
    const intentSection = page.locator('text=Intent Reactions').or(page.locator('text=Intent-Reaktionen'));
    await expect(intentSection).toBeVisible({ timeout: 10000 });
  });

  test('should list analytics intents from player-analytics module', async ({ page }) => {
    await page.goto(`${BASE_URL}/modules/wled`);
    await page.waitForLoadState('networkidle');
    
    // Check if analytics intents are available
    const response = await page.request.get(`${BASE_URL}/api/intents`);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.intents.length).toBeGreaterThan(0);
    
    // Check for analytics intents
    const analyticsIntents = data.intents.filter((i: { id: string }) => i.id.startsWith('analytics.'));
    expect(analyticsIntents.length).toBe(4);
  });
});
