import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// Helper to start a simulated match
const simulateMatchStart = async () => {
  return fetch(`${BASE_URL}/api/developer/simulate/match/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      players: [{ name: 'Player1' }, { name: 'Player2' }]
    })
  });
};

// Simulate a throw
const simulateThrow = async (number: number, multiplier: 1 | 2 | 3) => {
  return fetch(`${BASE_URL}/api/developer/simulate/throw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, multiplier })
  });
};

// End turn
const simulateTurnEnd = async () => {
  return fetch(`${BASE_URL}/api/developer/simulate/turn/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
};

// End match
const simulateMatchEnd = async (winner: number = 0) => {
  return fetch(`${BASE_URL}/api/developer/simulate/match/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ winner })
  });
};

// Run predefined scenario
const runScenario = async (scenarioId: string) => {
  return fetch(`${BASE_URL}/api/developer/scenarios/${scenarioId}/run`, {
    method: 'POST'
  });
};

// Enable developer mode
const enableDeveloperMode = async () => {
  return fetch(`${BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ developerMode: true })
  });
};

test.describe('Autodarts Trainer - Simulate Game', () => {
  test.beforeAll(async () => {
    // Enable developer mode
    console.log('Enabling developer mode...');
    await enableDeveloperMode();

    // Ensure trainer module is running
    console.log('Checking module status...');
    const response = await fetch(`${BASE_URL}/api/modules`);
    const modules = await response.json() as Array<{ id: string; status: string }>;
    const trainer = modules.find((m: { id: string }) => m.id === 'autodarts-trainer');

    if (!trainer) {
      console.error('Trainer module not installed!');
      throw new Error('Trainer module not installed');
    }

    console.log('Trainer status:', trainer.status);

    if (trainer.status !== 'running') {
      console.log('Starting trainer module...');
      await fetch(`${BASE_URL}/api/modules/autodarts-trainer/start`, { method: 'POST' });
      // Wait a bit for module to start
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('Trainer module is ready');
  });

  test('should simulate a game and verify trainer processes events', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Start a new match
    console.log('=== STEP 1: Starting Match ===');
    const matchStartResponse = await simulateMatchStart();
    const matchResult = await matchStartResponse.json() as { success: boolean; matchId?: string };
    console.log('Match started:', matchResult);
    expect(matchResult.success).toBeTruthy();
    await page.waitForTimeout(1000);

    // 2. Run 180 scenario (triggers throw events)
    console.log('=== STEP 2: Running 180 Scenario ===');
    const scenarioResponse = await runScenario('180');
    console.log('Scenario response:', scenarioResponse.status);
    expect(scenarioResponse.ok).toBeTruthy();
    await page.waitForTimeout(1000);

    // 3. End the turn
    console.log('=== STEP 3: Ending Turn ===');
    const turnEndResponse = await simulateTurnEnd();
    const turnResult = await turnEndResponse.json() as { success: boolean; nextPlayer?: string };
    console.log('Turn ended:', turnResult);
    expect(turnResult.success).toBeTruthy();
    await page.waitForTimeout(1000);

    // 4. Simulate more turns to trigger recommendations
    console.log('=== STEP 4: Simulating More Turns ===');
    for (let i = 0; i < 5; i++) {
      // Throw 3 darts
      await simulateThrow(20, 3); // T20
      await page.waitForTimeout(100);
      await simulateThrow(20, 3); // T20
      await page.waitForTimeout(100);
      await simulateThrow(20, 1); // 20
      await page.waitForTimeout(100);

      // End turn
      const response = await simulateTurnEnd();
      console.log(`Turn ${i + 2} ended:`, (await response.json() as { nextPlayer?: string }).nextPlayer);
      await page.waitForTimeout(500);
    }

    // 5. End the match
    console.log('=== STEP 5: Ending Match ===');
    const matchEndResponse = await simulateMatchEnd(0);
    console.log('Match end response:', matchEndResponse.status);
    expect(matchEndResponse.ok).toBeTruthy();
    await page.waitForTimeout(1000);

    // 6. Verify trainer module is still running
    console.log('=== STEP 6: Verifying Trainer Status ===');
    const statusResponse = await fetch(`${BASE_URL}/api/modules`);
    const finalModules = await statusResponse.json() as Array<{ id: string; status: string }>;
    const trainerModule = finalModules.find((m: { id: string }) => m.id === 'autodarts-trainer');

    console.log('Final trainer status:', trainerModule?.status);
    expect(trainerModule?.status).toBe('running');

    console.log('=== TEST COMPLETE ===');
    console.log('Game simulation completed successfully!');
    console.log('The trainer module processed all events without crashing.');
  });

  test('should verify trainer module is responding', async ({ page }) => {
    test.setTimeout(30000);

    console.log('=== Verifying Trainer Module ===');

    // Check module status
    const response = await fetch(`${BASE_URL}/api/modules`);
    const modules = await response.json() as Array<{ id: string; status: string; name: string }>;
    const trainer = modules.find((m: { id: string }) => m.id === 'autodarts-trainer');

    expect(trainer).toBeDefined();
    console.log('Trainer module found:', trainer?.name);
    console.log('Status:', trainer?.status);

    // If running, verify it's working
    if (trainer?.status === 'running') {
      // Check developer status
      const devResponse = await fetch(`${BASE_URL}/api/developer/status`);
      const devStatus = await devResponse.json() as { enabled: boolean; matchActive: boolean };
      console.log('Developer mode:', devStatus.enabled);
      console.log('Match active:', devStatus.matchActive);

      expect(devResponse.ok).toBeTruthy();
    }

    expect(trainer?.status).toBe('running');
    console.log('Trainer module verification complete!');
  });
});
