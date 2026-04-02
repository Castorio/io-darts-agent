const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5173/modules/game-display/game-display-config');
    await page.waitForTimeout(2000);
    
    // Login
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Search for specific option texts
    console.log('=== Searching for Win Animation Options ===');
    const options = ['Show Winner Name', 'Show Statistics', 'Effect', 'Background Color', 'Text Color'];
    for (const opt of options) {
      const count = await page.locator('text=' + opt).count();
      console.log('"' + opt + '": ' + count + ' occurrences');
    }
    
    // Check for confetti/fireworks/sparkles buttons
    console.log('\n=== Searching for Effect Buttons ===');
    const effects = ['None', 'Confetti', 'Fireworks', 'Sparkles'];
    for (const effect of effects) {
      const count = await page.locator('button:has-text("' + effect + '")').count();
      console.log('Button "' + effect + '": ' + count + ' found');
    }
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/config-options.png', fullPage: true });
    console.log('\nScreenshot saved to /tmp/config-options.png');
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
