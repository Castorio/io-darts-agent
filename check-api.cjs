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
    
    // Fetch API with auth session
    const moduleData = await page.evaluate(async () => {
      const response = await fetch('/api/modules/game-display');
      return await response.json();
    });
    
    // Check specifically animationLegWin fields
    const legWinFields = moduleData.config?.schema?.animationLegWin?.fields;
    console.log('animationLegWin fields from API:');
    console.log(JSON.stringify(legWinFields, null, 2));
    
    console.log('\nKeys in animationLegWin.fields:');
    if (legWinFields) {
      console.log(Object.keys(legWinFields));
    } else {
      console.log('NO FIELDS FOUND!');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
