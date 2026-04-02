const { chromium } = require('playwright');

(async () => {
  // Use persistent context to keep sessions
  const userDataDir = './playwright-user-data';
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });

  const page = browser.pages()[0] || await browser.newPage();

  console.log('Navigating to main page...');
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(2000);

  let pageContent = await page.content();
  console.log('Current URL:', page.url());

  // Take initial screenshot
  await page.screenshot({ path: 'test-results/01-initial.png', fullPage: true });

  // Check if we need to login
  if (pageContent.includes('401') || pageContent.includes('Unauthorized') || pageContent.includes('Login')) {
    console.log('Login required - please login manually in the browser window');
    console.log('Waiting 30 seconds for manual login...');
    await page.waitForTimeout(30000);

    // Check again
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(2000);
  }

  // Navigate to Game Display module config
  console.log('Navigating to Game Display module...');
  await page.goto('http://localhost:3000/modules/game-display/config');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'test-results/02-game-display-config.png', fullPage: true });
  console.log('Screenshot saved: 02-game-display-config.png');

  // Scroll down to find animations section
  console.log('Scrolling to find animations...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'test-results/03-scrolled-down.png', fullPage: true });

  // Look for Match Win Animation section
  console.log('\n=== Checking for Win Animation Options ===\n');

  const matchWinText = await page.locator('text=Match Win').first().isVisible().catch(() => false);
  console.log('Match Win Animation visible:', matchWinText);

  const legWinText = await page.locator('text=Leg Win').first().isVisible().catch(() => false);
  console.log('Leg Win Animation visible:', legWinText);

  // Check for specific options
  const optionsToCheck = [
    'Show Winner Name',
    'Show Statistics',
    'Effect',
    'Background Color',
    'Text Color',
    'Win Animation'
  ];

  for (const option of optionsToCheck) {
    const isVisible = await page.locator('text=' + option).first().isVisible().catch(() => false);
    console.log(option + ':', isVisible ? 'VISIBLE' : 'NOT VISIBLE');
  }

  // Get all text content to see what's there
  console.log('\n=== Looking for all animation-related text ===');
  const allText = await page.textContent('body');
  const keywords = ['Win', 'Effect', 'Confetti', 'Fireworks', 'Statistics', 'Winner', 'Animation'];
  for (const kw of keywords) {
    const found = allText.includes(kw);
    console.log(kw + ' found in page:', found);
  }

  // Check if type is set to builtin for match win
  console.log('\n=== Checking Type selector states ===');
  const typeSelectors = await page.locator('select').all();
  console.log('Found', typeSelectors.length, 'select elements');

  for (let i = 0; i < Math.min(typeSelectors.length, 10); i++) {
    const value = await typeSelectors[i].inputValue().catch(() => 'error');
    console.log('Select ' + i + ' value:', value);
  }

  await page.screenshot({ path: 'test-results/04-final.png', fullPage: true });
  console.log('\n=== Test complete ===');
  console.log('Screenshots saved in test-results/');
  console.log('\nKeeping browser open for 60 seconds for inspection...');

  await page.waitForTimeout(60000);

  await browser.close();
})();
