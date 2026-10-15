import { describe, it, expect } from 'vitest';
import { buildWledTestPayload } from '../../../src/api/routes/modules.js';

describe('buildWledTestPayload', () => {
  it('adds the fade time as a per-call tt in 100 ms units', () => {
    expect(buildWledTestPayload({ actionType: 'preset', presetId: 4, fadeTime: 5000 })).toEqual({ ps: 4, tt: 50 });
  });

  it('sends tt 0 for an explicit instant change', () => {
    expect(buildWledTestPayload({ actionType: 'off', fadeTime: 0 })).toEqual({ on: false, tt: 0 });
  });

  it('leaves the device default alone without a fade time', () => {
    expect(buildWledTestPayload({ actionType: 'off' })).toEqual({ on: false });
  });

  it('ignores an invalid fade time', () => {
    expect(buildWledTestPayload({ actionType: 'off', fadeTime: -10 })).toEqual({ on: false });
  });
});
