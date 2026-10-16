import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { isValidModuleId, resolveModuleUiFile } from './moduleUiPath.js';

const root = path.resolve('/srv/hub/modules/game-display/web/dist');

describe('resolveModuleUiFile', () => {
  it('resolves files inside the module UI folder', () => {
    expect(resolveModuleUiFile(root, 'index.html')).toBe(path.join(root, 'index.html'));
    expect(resolveModuleUiFile(root, 'assets/app.js')).toBe(path.join(root, 'assets', 'app.js'));
  });

  it.each([
    '../../secret',
    '../../../../config/hub.config.json',
    'assets/../../web/dist/../../x',
    '/etc/passwd',
    '..',
    'a\0b',
  ])('refuses %j', (splat) => {
    expect(resolveModuleUiFile(root, splat)).toBeNull();
  });
});

describe('isValidModuleId', () => {
  it.each(['game-display', 'wled', 'autodarts_trainer'])('accepts %s', (id) => {
    expect(isValidModuleId(id)).toBe(true);
  });

  it.each(['..', '../x', 'a/b', '', '.hidden'])('rejects %j', (id) => {
    expect(isValidModuleId(id)).toBe(false);
  });
});
