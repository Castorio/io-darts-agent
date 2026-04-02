import { test, expect } from '@playwright/test';

test.describe('MQTT Intent Visibility Debug', () => {
  test('debug intents on darts-caller module page', async ({ page }) => {
    // Track console logs and errors
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    const networkRequests: { url: string; status: number; body?: string }[] = [];

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else {
        consoleLogs.push(`[${msg.type()}] ${text}`);
      }
    });

    // Track API responses
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/')) {
        try {
          const body = await response.text();
          networkRequests.push({ url, status: response.status(), body });
        } catch {
          networkRequests.push({ url, status: response.status() });
        }
      }
    });

    // Login first
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1000);

    const usernameInput = page.locator('input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]');

    if (await usernameInput.isVisible()) {
      await usernameInput.fill('admin');
      await passwordInput.fill('admin');
      await page.click('button:has-text("Anmelden")');
      await page.waitForTimeout(2000);
    }

    // Navigate to darts-caller module
    await page.goto('http://localhost:5173/modules/darts-caller');
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/darts-caller-intents.png', fullPage: true });

    // === DEBUG OUTPUT ===
    console.log('\n=== URL ===');
    console.log(page.url());

    console.log('\n=== PAGE CONTENT (first 2000 chars) ===');
    const pageText = await page.locator('body').innerText();
    console.log(pageText.substring(0, 2000));

    console.log('\n=== INTENT-RELATED API REQUESTS ===');
    const intentRequests = networkRequests.filter(r =>
      r.url.includes('intent') || r.url.includes('available')
    );
    intentRequests.forEach(req => {
      console.log(`\nURL: ${req.url}`);
      console.log(`Status: ${req.status}`);
      if (req.body) {
        try {
          const parsed = JSON.parse(req.body);
          console.log('Response:', JSON.stringify(parsed, null, 2).substring(0, 1000));
        } catch {
          console.log('Response:', req.body.substring(0, 500));
        }
      }
    });

    console.log('\n=== ALL API REQUESTS ===');
    networkRequests.forEach(req => {
      console.log(`${req.status} ${req.url}`);
    });

    // Check for Intent Reactions section
    console.log('\n=== LOOKING FOR INTENT SECTION ===');

    const intentSectionTexts = [
      'Intent Reactions',
      'Intent-Reaktionen',
      'Keine Intents verfügbar',
      'No intents available'
    ];

    for (const text of intentSectionTexts) {
      const element = page.locator(`text=${text}`);
      const count = await element.count();
      console.log(`Text "${text}": ${count > 0 ? 'FOUND' : 'NOT FOUND'} (count: ${count})`);
    }

    // Check hasIntentSupport condition - look for the BaseCard with intent section
    console.log('\n=== CHECKING MODULE INTENT CONFIG RESPONSE ===');
    const moduleIntentsReq = networkRequests.find(r => r.url.includes('/api/modules/darts-caller/intents'));
    if (moduleIntentsReq) {
      console.log('Module Intents Response:', moduleIntentsReq.body);
    } else {
      console.log('NO /api/modules/darts-caller/intents request found!');
    }

    console.log('\n=== CHECKING AVAILABLE INTENTS RESPONSE ===');
    const availableIntentsReq = networkRequests.find(r => r.url.includes('/api/intents'));
    if (availableIntentsReq) {
      console.log('Available Intents Response:', availableIntentsReq.body);
    } else {
      console.log('NO /api/intents request found!');
    }

    console.log('\n=== CONSOLE ERRORS ===');
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(e => console.log(e));
    } else {
      console.log('No console errors');
    }

    console.log('\n=== RELEVANT CONSOLE LOGS ===');
    const relevantLogs = consoleLogs.filter(l =>
      l.toLowerCase().includes('intent') ||
      l.toLowerCase().includes('mqtt') ||
      l.toLowerCase().includes('error')
    );
    relevantLogs.forEach(l => console.log(l));

    // Make direct API call to check intents endpoint
    console.log('\n=== DIRECT API CHECK: /api/intents ===');
    const apiResponse = await page.request.get('http://localhost:5173/api/intents');
    const apiData = await apiResponse.json();
    console.log('Direct API Response:', JSON.stringify(apiData, null, 2));

    // Check if MQTT intents are in the response
    if (apiData.intents) {
      const mqttIntents = apiData.intents.filter((i: { id: string }) =>
        i.id.toLowerCase().includes('mqtt') || i.sourceModule?.toLowerCase().includes('mqtt')
      );
      console.log('\n=== MQTT INTENTS ===');
      console.log(`Found ${mqttIntents.length} MQTT intents:`);
      mqttIntents.forEach((i: { id: string; description: string; sourceModule?: string }) => {
        console.log(`  - ${i.id}: ${i.description} (from: ${i.sourceModule})`);
      });
    }

    // Also check /api/intents/available
    console.log('\n=== DIRECT API CHECK: /api/intents/available ===');
    const availableResponse = await page.request.get('http://localhost:5173/api/intents/available');
    const availableData = await availableResponse.json();
    console.log('Available Intents Response:', JSON.stringify(availableData, null, 2));

    // Check for MQTT module manifest
    console.log('\n=== CHECKING MQTT MODULE ===');
    const modulesResponse = await page.request.get('http://localhost:5173/api/modules');
    const modulesData = await modulesResponse.json();
    console.log('All Modules:');
    modulesData.forEach((m: { id: string; name: string; status: string }) => {
      console.log(`  - ${m.id}: ${m.name} (${m.status})`);
    });

    // Check MQTT module specifically if exists
    const mqttModule = modulesData.find((m: { id: string }) => m.id === 'mqtt');
    if (mqttModule) {
      console.log('\n=== MQTT MODULE DETAILS ===');
      console.log(JSON.stringify(mqttModule, null, 2));

      // Get MQTT module intents config
      const mqttIntentsResponse = await page.request.get('http://localhost:5173/api/modules/mqtt/intents');
      const mqttIntentsData = await mqttIntentsResponse.json();
      console.log('\nMQTT Module Intents Config:', JSON.stringify(mqttIntentsData, null, 2));
    } else {
      console.log('\nMQTT module NOT FOUND in modules list!');
    }

    // The key assertion - check if intent section is visible
    // Note: hasIntentSupport = availableIntents.length > 0 && availableActions.length > 0
    // So we need both intents to be available AND the darts-caller module to have actions

    console.log('\n=== CHECKING DARTS-CALLER ACTIONS ===');
    const dartCallerIntentsResponse = await page.request.get('http://localhost:5173/api/modules/darts-caller/intents');
    const dartCallerIntentsData = await dartCallerIntentsResponse.json();
    console.log('Darts-Caller Intents Config:', JSON.stringify(dartCallerIntentsData, null, 2));
  });
});
