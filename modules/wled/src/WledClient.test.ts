import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WledClient, WLED_EFFECTS, WLED_COLORS } from './WledClient.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WledClient', () => {
  let client: WledClient;

  beforeEach(() => {
    client = new WledClient({ host: '192.168.1.100' });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default port', () => {
      expect(client.getBaseUrl()).toBe('http://192.168.1.100:80');
    });

    it('should create client with custom port', () => {
      const customClient = new WledClient({ host: '192.168.1.100', port: 8080 });
      expect(customClient.getBaseUrl()).toBe('http://192.168.1.100:8080');
    });
  });

  describe('getInfo()', () => {
    it('should fetch device info', async () => {
      const mockInfo = {
        ver: '0.14.0',
        vid: 2312140,
        leds: { count: 60, rgbw: false },
        name: 'WLED',
        mac: 'AA:BB:CC:DD:EE:FF',
        ip: '192.168.1.100',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockInfo),
      });

      const info = await client.getInfo();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:80/json/info',
        expect.objectContaining({ method: 'GET' })
      );
      expect(info.ver).toBe('0.14.0');
      expect(info.name).toBe('WLED');
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.getInfo()).rejects.toThrow('WLED request failed: 500');
    });
  });

  describe('getState()', () => {
    it('should fetch current state', async () => {
      const mockState = {
        on: true,
        bri: 128,
        transition: 7,
        ps: 1,
        pl: -1,
        seg: [{ col: [[255, 0, 0]] }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockState),
      });

      const state = await client.getState();

      expect(state.on).toBe(true);
      expect(state.bri).toBe(128);
    });
  });

  describe('setState()', () => {
    it('should set state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.setState({ on: true, bri: 200 });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:80/json/state',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ on: true, bri: 200 }),
        })
      );
    });
  });

  describe('turnOn() / turnOff()', () => {
    it('should turn on', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.turnOn();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ on: true }),
        })
      );
    });

    it('should turn off', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.turnOff();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ on: false }),
        })
      );
    });
  });

  describe('setBrightness()', () => {
    it('should set brightness', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.setBrightness(150);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ bri: 150 }),
        })
      );
    });

    it('should clamp brightness to 0-255', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.setBrightness(300);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ bri: 255 }),
        })
      );
    });

    it('should clamp negative brightness to 0', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.setBrightness(-50);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ bri: 0 }),
        })
      );
    });
  });

  describe('setColor()', () => {
    it('should set solid color', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.setColor(WLED_COLORS.RED);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            seg: [{ col: [[255, 0, 0]], fx: WLED_EFFECTS.SOLID }],
          }),
        })
      );
    });

    it('should set green color', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.setColor(WLED_COLORS.GREEN);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            seg: [{ col: [[0, 255, 0]], fx: WLED_EFFECTS.SOLID }],
          }),
        })
      );
    });
  });

  describe('setEffect()', () => {
    it('should set effect by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.setEffect(WLED_EFFECTS.RAINBOW);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ seg: [{ fx: WLED_EFFECTS.RAINBOW }] }),
        })
      );
    });

    it('should set effect with speed and intensity', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.setEffect(WLED_EFFECTS.FIRE_2012, 200, 128);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ seg: [{ fx: WLED_EFFECTS.FIRE_2012, sx: 200, ix: 128 }] }),
        })
      );
    });
  });

  describe('loadPreset()', () => {
    it('should load preset by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.loadPreset(5);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ ps: 5 }),
        })
      );
    });
  });

  describe('ping()', () => {
    it('should return true when device is reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ver: '0.14.0' }),
      });

      const result = await client.ping();
      expect(result).toBe(true);
    });

    it('should return false when device is not reachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.ping();
      expect(result).toBe(false);
    });
  });

  describe('flash()', () => {
    it('should flash color and restore', async () => {
      // Mock getState
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          on: true,
          bri: 128,
          seg: [{ col: [[0, 0, 255]] }],
        }),
      });

      // Mock setColor
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Mock restore
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.flash(WLED_COLORS.RED, 100);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('getPresets()', () => {
    it('should fetch all presets', async () => {
      const mockPresets = {
        '1': { n: 'Game On', on: true, bri: 255 },
        '2': { n: 'Celebration', on: true, bri: 255 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPresets),
      });

      const presets = await client.getPresets();

      expect(presets['1'].n).toBe('Game On');
      expect(presets['2'].n).toBe('Celebration');
    });
  });

  describe('getEffects()', () => {
    it('should fetch all effects', async () => {
      const mockEffects = ['Solid', 'Blink', 'Breathe', 'Rainbow'];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEffects),
      });

      const effects = await client.getEffects();

      expect(effects).toContain('Solid');
      expect(effects).toContain('Rainbow');
    });
  });

  describe('setTransition()', () => {
    it('should set transition time', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.setTransition(10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ transition: 10 }),
        })
      );
    });
  });
});

describe('WLED_EFFECTS', () => {
  it('should have common effects defined', () => {
    expect(WLED_EFFECTS.SOLID).toBe(0);
    expect(WLED_EFFECTS.RAINBOW).toBe(9);
    expect(WLED_EFFECTS.FIRE_2012).toBe(52);
    expect(WLED_EFFECTS.FIREWORKS).toBe(82);
  });
});

describe('WLED_COLORS', () => {
  it('should have common colors defined', () => {
    expect(WLED_COLORS.RED).toEqual({ r: 255, g: 0, b: 0 });
    expect(WLED_COLORS.GREEN).toEqual({ r: 0, g: 255, b: 0 });
    expect(WLED_COLORS.BLUE).toEqual({ r: 0, g: 0, b: 255 });
    expect(WLED_COLORS.WHITE).toEqual({ r: 255, g: 255, b: 255 });
  });
});
