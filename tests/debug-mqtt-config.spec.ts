import { test, expect } from '@playwright/test';

test('debug MQTT module config page with login', async ({ page }) => {
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

  // Erst einloggen
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // Login-Felder ausfüllen
  const usernameInput = page.locator('input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]');

  await usernameInput.fill('admin');
  await passwordInput.fill('admin');
  await page.click('button:has-text("Anmelden")');

  // Warte auf Navigation nach Login
  await page.waitForTimeout(2000);

  console.log('=== AFTER LOGIN ===');
  console.log('URL:', page.url());

  // Jetzt zur MQTT-Modul-Seite navigieren
  await page.goto('http://localhost:5173/modules/mqtt');
  await page.waitForTimeout(2000);

  // Screenshot machen
  await page.screenshot({ path: 'test-results/mqtt-config-loggedin.png', fullPage: true });

  console.log('=== PAGE TITLE ===');
  console.log(await page.title());

  console.log('=== VISIBLE TEXT ===');
  const bodyText = await page.locator('body').innerText();
  console.log(bodyText.substring(0, 3000));

  console.log('=== FORM ELEMENTS ===');
  const inputs = await page.locator('input').all();
  console.log('Found ' + inputs.length + ' input elements');
  for (const input of inputs) {
    const name = await input.getAttribute('name');
    const id = await input.getAttribute('id');
    const type = await input.getAttribute('type');
    const disabled = await input.isDisabled();
    const visible = await input.isVisible();
    const value = await input.inputValue().catch(() => '');
    console.log('  Input: id=' + id + ', name=' + name + ', type=' + type + ', disabled=' + disabled + ', visible=' + visible + ', value="' + value + '"');
  }

  const selects = await page.locator('select').all();
  console.log('Found ' + selects.length + ' select elements');
  for (const sel of selects) {
    const id = await sel.getAttribute('id');
    const disabled = await sel.isDisabled();
    console.log('  Select: id=' + id + ', disabled=' + disabled);
  }

  const textareas = await page.locator('textarea').all();
  console.log('Found ' + textareas.length + ' textarea elements');

  const buttons = await page.locator('button').all();
  console.log('Found ' + buttons.length + ' button elements');
  for (const btn of buttons) {
    const text = await btn.innerText().catch(() => '');
    const disabled = await btn.isDisabled();
    const visible = await btn.isVisible();
    console.log('  Button: "' + text.substring(0,30) + '", disabled=' + disabled + ', visible=' + visible);
  }

  // Prüfe auf Error-Meldungen
  console.log('=== ERROR ELEMENTS ===');
  const errorElements = await page.locator('.error, .alert-error, [class*="error"], .text-red').all();
  for (const el of errorElements) {
    const text = await el.innerText().catch(() => '');
    if (text) console.log('  Error: ' + text);
  }

  console.log('=== CONSOLE ERRORS ===');
  console.log(consoleErrors.join('\n') || 'No console errors');

  console.log('=== RELEVANT CONSOLE LOGS ===');
  consoleLogs.filter(l => l.includes('config') || l.includes('mqtt') || l.includes('error')).forEach(l => console.log(l));

  // Versuche ein Input zu finden und zu editieren
  console.log('=== TRYING TO INTERACT ===');
  const firstInput = page.locator('input:visible').first();
  if (await firstInput.count() > 0) {
    try {
      await firstInput.click();
      console.log('Clicked on first input successfully');
      await firstInput.fill('test-value');
      console.log('Filled first input successfully');
    } catch (e: any) {
      console.log('Error interacting with input:', e.message);
    }
  } else {
    console.log('No visible inputs found!');
  }

  // Finaler Screenshot
  await page.screenshot({ path: 'test-results/mqtt-config-final.png', fullPage: true });
});
