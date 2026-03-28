import { chromium } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_IMAGES = path.join(__dirname, '..', 'docs', 'images');
const BASE_URL = 'http://localhost:3000';

async function takeScreenshots() {
  console.log('🎬 Starting screenshot capture...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2, // Retina quality
  });
  const page = await context.newPage();

  // Helper function for screenshots
  async function screenshot(name: string, waitFor?: string) {
    const filePath = path.join(DOCS_IMAGES, `${name}.png`);
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 5000 }).catch(() => {});
    }
    await page.waitForTimeout(500); // Let animations settle
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`📸 ${name}.png`);
  }

  try {
    // 1. Setup Page (wenn nicht eingerichtet)
    console.log('\n📋 Checking setup status...');
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/setup')) {
      console.log('   Taking setup screenshots...');
      await screenshot('01-setup-welcome', 'h1');

      // Fill in demo data for screenshot
      await page.fill('input[type="email"]', 'user@example.com');
      await page.fill('input[type="password"]', '••••••••');
      await screenshot('02-setup-credentials');
    }

    // Check if we need to login
    if (currentUrl.includes('/login')) {
      console.log('   Taking login screenshot...');
      await screenshot('login-page', 'form');
    }

    // 2. Dashboard (if accessible)
    console.log('\n📊 Dashboard...');
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(1000);

    if (!page.url().includes('/setup') && !page.url().includes('/login')) {
      await screenshot('03-dashboard', 'main');
    }

    // 3. Modules List
    console.log('\n📦 Modules...');
    await page.goto(`${BASE_URL}/modules`);
    await page.waitForTimeout(1000);

    if (!page.url().includes('/setup') && !page.url().includes('/login')) {
      await screenshot('04-modules-list');
    }

    // 4. WLED Module Detail
    console.log('\n💡 WLED Module...');
    await page.goto(`${BASE_URL}/modules/wled`);
    await page.waitForTimeout(1000);

    if (!page.url().includes('/setup') && !page.url().includes('/login')) {
      await screenshot('05-wled-module');
    }

    // 5. WLED Config
    await page.goto(`${BASE_URL}/modules/wled/config`);
    await page.waitForTimeout(1000);

    if (!page.url().includes('/setup') && !page.url().includes('/login')) {
      await screenshot('06-wled-config');
    }

    // 6. Game Display Module
    console.log('\n🎯 Game Display...');
    await page.goto(`${BASE_URL}/modules/game-display`);
    await page.waitForTimeout(1000);

    if (!page.url().includes('/setup') && !page.url().includes('/login')) {
      await screenshot('07-game-display-module');
    }

    // 7. Game Display Config
    await page.goto(`${BASE_URL}/modules/game-display/game-display-config`);
    await page.waitForTimeout(1000);

    if (!page.url().includes('/setup') && !page.url().includes('/login')) {
      await screenshot('08-game-display-config');
    }

    // 8. Game Display UI (module's own frontend)
    console.log('\n🖥️ Game Display UI...');
    await page.goto(`${BASE_URL}/module-ui/game-display/`);
    await page.waitForTimeout(2000);
    await screenshot('09-game-display-ui');

    // Click demo button if available
    const demoButton = page.locator('button:has-text("Demo")');
    if (await demoButton.isVisible()) {
      await demoButton.click();
      await page.waitForTimeout(1500);
      await screenshot('10-game-display-demo');
    }

    // 9. Players
    console.log('\n👥 Players...');
    await page.goto(`${BASE_URL}/players`);
    await page.waitForTimeout(1000);

    if (!page.url().includes('/setup') && !page.url().includes('/login')) {
      await screenshot('11-players');
    }

    // 10. Logs
    console.log('\n📜 Logs...');
    await page.goto(`${BASE_URL}/logs`);
    await page.waitForTimeout(1000);

    if (!page.url().includes('/setup') && !page.url().includes('/login')) {
      await screenshot('12-logs');
    }

    // 11. Settings
    console.log('\n⚙️ Settings...');
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForTimeout(1000);

    if (!page.url().includes('/setup') && !page.url().includes('/login')) {
      await screenshot('13-settings');
    }

    // 12. Module Install
    console.log('\n📥 Module Install...');
    await page.goto(`${BASE_URL}/modules/install`);
    await page.waitForTimeout(1000);

    if (!page.url().includes('/setup') && !page.url().includes('/login')) {
      await screenshot('14-module-install');
    }

    console.log('\n✅ Screenshots complete!');
    console.log(`   Saved to: ${DOCS_IMAGES}`);

  } catch (error) {
    console.error('❌ Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
}

// Run
takeScreenshots();
