import { test, expect } from '@playwright/test';

// Local checkout of the trainer module, e.g. TRAINER_MODULE_PATH=../autodarts-trainer-module
const MODULE_PATH = process.env.TRAINER_MODULE_PATH ?? '';

test.describe('Install Autodarts Trainer Module', () => {
  test.skip(!MODULE_PATH, 'Set TRAINER_MODULE_PATH to run this test');

  test('should install module from local path and verify it works', async ({ page }) => {
    // Increase timeout for this test
    test.setTimeout(60000);

    // Console Errors tracken
    const consoleErrors: string[] = [];
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        consoleErrors.push(text);
      } else {
        consoleLogs.push('[' + type + '] ' + text);
      }
    });

    // 1. Go to dashboard (login may or may not be required)
    console.log('=== STEP 1: NAVIGATE TO APP ===');
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2000);

    // Check if login is required
    const loginButton = page.locator('button:has-text("Anmelden"), button:has-text("Login")');
    if (await loginButton.count() > 0) {
      console.log('Login required, logging in...');
      const usernameInput = page.locator('input[type="text"]').first();
      const passwordInput = page.locator('input[type="password"]');
      await usernameInput.fill('admin');
      await passwordInput.fill('admin');
      await loginButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('Already logged in or no login required');
    }

    console.log('Current URL:', page.url());

    // 2. Navigate to module installation page
    console.log('=== STEP 2: NAVIGATE TO MODULE INSTALL ===');
    await page.goto('http://localhost:5173/modules/install');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/trainer-install-page.png', fullPage: true });

    // 3. Select "Local Path" option
    console.log('=== STEP 3: SELECT LOCAL PATH ===');
    const localPathButton = page.locator('button:has-text("Lokaler Pfad"), button:has-text("Local")');
    if (await localPathButton.count() > 0) {
      await localPathButton.first().click();
      console.log('Clicked on Local Path button');
    } else {
      // Try clicking on the second button in the grid (local path option)
      const buttons = page.locator('.grid button');
      if (await buttons.count() >= 2) {
        await buttons.nth(1).click();
        console.log('Clicked on second grid button (Local Path)');
      }
    }
    await page.waitForTimeout(500);

    // 4. Enter the module path
    console.log('=== STEP 4: ENTER MODULE PATH ===');
    const pathInput = page.locator('input[placeholder*="home"], input[placeholder*="path"], input[type="text"]').last();
    await pathInput.fill(MODULE_PATH);
    console.log('Entered path:', MODULE_PATH);

    await page.screenshot({ path: 'test-results/trainer-path-entered.png', fullPage: true });

    // 5. Click install button
    console.log('=== STEP 5: CLICK INSTALL ===');
    const installButton = page.locator('button[type="submit"], button:has-text("Installieren"), button:has-text("Install")');
    await installButton.click();
    console.log('Clicked install button');

    // 6. Wait for installation to complete (may redirect or show success)
    console.log('=== STEP 6: WAIT FOR INSTALLATION ===');
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'test-results/trainer-after-install.png', fullPage: true });

    const currentUrl = page.url();
    console.log('Current URL after install:', currentUrl);

    // Check for success message or redirect
    const bodyText = await page.locator('body').innerText();
    console.log('Page content (first 2000 chars):', bodyText.substring(0, 2000));

    // 7. Verify module is in the list
    console.log('=== STEP 7: VERIFY MODULE IN LIST ===');
    await page.goto('http://localhost:5173/modules');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/trainer-modules-list.png', fullPage: true });

    const modulesListText = await page.locator('body').innerText();
    const moduleInstalled = modulesListText.includes('Autodarts Trainer') ||
                           modulesListText.includes('autodarts-trainer');

    console.log('Module appears in list:', moduleInstalled);
    console.log('Modules page content:', modulesListText.substring(0, 3000));

    // 8. Navigate to the module detail page
    console.log('=== STEP 8: CHECK MODULE DETAIL PAGE ===');
    await page.goto('http://localhost:5173/modules/autodarts-trainer');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/trainer-detail-page.png', fullPage: true });

    const detailText = await page.locator('body').innerText();
    console.log('Module detail page content:', detailText.substring(0, 3000));

    // Check for configuration options
    const hasConfig = detailText.includes('Coaching Mode') ||
                      detailText.includes('Enable Trainer') ||
                      detailText.includes('Trainer aktivieren');
    console.log('Has config options:', hasConfig);

    // Check for intents
    const hasIntents = detailText.includes('showRecommendation') ||
                       detailText.includes('Show Recommendation') ||
                       detailText.includes('Intent');
    console.log('Has intents:', hasIntents);

    // Print console errors
    console.log('=== CONSOLE ERRORS ===');
    if (consoleErrors.length > 0) {
      console.log(consoleErrors.join('\n'));
    } else {
      console.log('No console errors');
    }

    // Assert module is installed
    expect(moduleInstalled || currentUrl.includes('autodarts-trainer')).toBeTruthy();
  });
});
