/**
 * WLED API Client
 *
 * Communicates with WLED controllers via HTTP JSON API
 * https://kno.wled.ge/interfaces/json-api/
 */

export interface WledState {
  on: boolean;
  bri: number;
  transition: number;
  ps: number; // Current preset
  pl: number; // Current playlist
  seg: WledSegment[];
}

export interface WledSegment {
  id?: number;
  start?: number;
  stop?: number;
  len?: number;
  col?: [number, number, number][];
  fx?: number;
  sx?: number;
  ix?: number;
  pal?: number;
  sel?: boolean;
  rev?: boolean;
  on?: boolean;
  bri?: number;
}

export interface WledInfo {
  ver: string;
  vid: number;
  leds: {
    count: number;
    rgbw: boolean;
    wv: boolean;
    cct: boolean;
    pwr: number;
    fps: number;
    maxpwr: number;
    maxseg: number;
    seglock: boolean;
  };
  name: string;
  udpport: number;
  live: boolean;
  fxcount: number;
  palcount: number;
  wifi: {
    bssid: string;
    rssi: number;
    signal: number;
    channel: number;
  };
  fs?: {
    u: number;
    t: number;
    pmt: number;
  };
  ndc: number;
  arch: string;
  core: string;
  lwip: number;
  freeheap: number;
  uptime: number;
  opt: number;
  brand: string;
  product: string;
  mac: string;
  ip: string;
}

export interface WledPreset {
  n?: string; // Name
  on?: boolean;
  bri?: number;
  transition?: number;
  seg?: WledSegment[];
}

export interface WledEffect {
  id: number;
  name: string;
}

export interface WledPalette {
  id: number;
  name: string;
}

export interface WledClientOptions {
  host: string;
  port?: number;
  timeout?: number;
}

export interface WledColor {
  r: number;
  g: number;
  b: number;
  w?: number;
}

// Common effect IDs in WLED
export const WLED_EFFECTS = {
  SOLID: 0,
  BLINK: 1,
  BREATHE: 2,
  WIPE: 3,
  WIPE_RANDOM: 4,
  RANDOM_COLORS: 5,
  SWEEP: 6,
  DYNAMIC: 7,
  COLORLOOP: 8,
  RAINBOW: 9,
  SCAN: 10,
  DUAL_SCAN: 11,
  FADE: 12,
  THEATER: 13,
  THEATER_RAINBOW: 14,
  RUNNING: 15,
  SAW: 16,
  TWINKLE: 17,
  DISSOLVE: 18,
  DISSOLVE_RANDOM: 19,
  SPARKLE: 20,
  FLASH_SPARKLE: 21,
  HYPER_SPARKLE: 22,
  STROBE: 23,
  STROBE_RAINBOW: 24,
  MULTI_STROBE: 25,
  BLINK_RAINBOW: 26,
  ANDROID: 27,
  CHASE: 28,
  CHASE_RANDOM: 29,
  CHASE_RAINBOW: 30,
  CHASE_FLASH: 31,
  CHASE_FLASH_RANDOM: 32,
  CHASE_RAINBOW_WHITE: 33,
  COLORFUL: 34,
  TRAFFIC_LIGHT: 35,
  SWEEP_RANDOM: 36,
  RUNNING_2: 37,
  RED_BLUE: 38,
  RUNNING_COLOR: 39,
  RUNNING_RANDOM: 40,
  TRICOLOR: 41,
  TRICOLOR_FADE: 42,
  LIGHTNING: 43,
  ICU: 44,
  MULTI_COMET: 45,
  DUAL_LARSON: 46,
  RUNNING_RANDOM_2: 47,
  OSCILLATE: 48,
  PRIDE_2015: 49,
  JUGGLE: 50,
  PALETTE: 51,
  FIRE_2012: 52,
  COLORWAVES: 53,
  BPM: 54,
  FILL_NOISE: 55,
  NOISE_1: 56,
  NOISE_2: 57,
  NOISE_3: 58,
  NOISE_4: 59,
  COLORTWINKLE: 60,
  LAKE: 61,
  METEOR: 62,
  SMOOTH_METEOR: 63,
  RAILWAY: 64,
  RIPPLE: 65,
  TWINKLEFOX: 66,
  TWINKLECAT: 67,
  HALLOWEEN: 68,
  CANDY_CANE: 69,
  BOUNCING_BALLS: 70,
  SINELON: 71,
  SINELON_DUAL: 72,
  SINELON_RAINBOW: 73,
  POPCORN: 74,
  DRIP: 75,
  PLASMA: 76,
  PERCENT: 77,
  RIPPLE_RAINBOW: 78,
  HEARTBEAT: 79,
  PACIFICA: 80,
  CANDLE: 81,
  FIREWORKS: 82,
  FIREWORKS_STARBURST: 83,
  FIREWORKS_1D: 84,
  BOUNCING_BALLS_2: 85,
  SINELON_2: 86,
  DANCING_SHADOWS: 87,
  WASHING_MACHINE: 88,
  CANDY_CANE_2: 89,
  BLENDS: 90,
  TV_SIMULATOR: 91,
  DYNAMIC_SMOOTH: 92,
} as const;

// Common preset colors
export const WLED_COLORS = {
  RED: { r: 255, g: 0, b: 0 },
  GREEN: { r: 0, g: 255, b: 0 },
  BLUE: { r: 0, g: 0, b: 255 },
  WHITE: { r: 255, g: 255, b: 255 },
  YELLOW: { r: 255, g: 255, b: 0 },
  ORANGE: { r: 255, g: 165, b: 0 },
  PURPLE: { r: 128, g: 0, b: 128 },
  PINK: { r: 255, g: 105, b: 180 },
  CYAN: { r: 0, g: 255, b: 255 },
  OFF: { r: 0, g: 0, b: 0 },
} as const;

/**
 * WLED HTTP JSON API Client
 */
export class WledClient {
  private host: string;
  private port: number;
  private timeout: number;
  private baseUrl: string;

  constructor(options: WledClientOptions) {
    this.host = options.host;
    this.port = options.port ?? 80;
    this.timeout = options.timeout ?? 5000;
    this.baseUrl = `http://${this.host}:${this.port}`;
  }

  /**
   * Get WLED device info
   */
  async getInfo(): Promise<WledInfo> {
    const response = await this.request('/json/info');
    return response as WledInfo;
  }

  /**
   * Get current state
   */
  async getState(): Promise<WledState> {
    const response = await this.request('/json/state');
    return response as WledState;
  }

  /**
   * Get all presets
   */
  async getPresets(): Promise<Record<string, WledPreset>> {
    const response = await this.request('/json/presets');
    return response as Record<string, WledPreset>;
  }

  /**
   * Get all effects
   */
  async getEffects(): Promise<string[]> {
    const response = await this.request('/json/effects');
    return response as string[];
  }

  /**
   * Get all palettes
   */
  async getPalettes(): Promise<string[]> {
    const response = await this.request('/json/palettes');
    return response as string[];
  }

  /**
   * Set state (full control)
   */
  async setState(state: Partial<WledState>): Promise<void> {
    await this.request('/json/state', 'POST', state);
  }

  /**
   * Turn LEDs on
   */
  async turnOn(): Promise<void> {
    await this.setState({ on: true });
  }

  /**
   * Turn LEDs off
   */
  async turnOff(): Promise<void> {
    await this.setState({ on: false });
  }

  /**
   * Set brightness (0-255)
   */
  async setBrightness(brightness: number): Promise<void> {
    const bri = Math.max(0, Math.min(255, Math.round(brightness)));
    await this.setState({ bri });
  }

  /**
   * Set solid color
   */
  async setColor(color: WledColor): Promise<void> {
    const col: [number, number, number][] = [[color.r, color.g, color.b]];
    await this.setState({
      seg: [{ col, fx: WLED_EFFECTS.SOLID }],
    });
  }

  /**
   * Set effect by ID
   */
  async setEffect(effectId: number, speed?: number, intensity?: number): Promise<void> {
    const seg: WledSegment = { fx: effectId };
    if (speed !== undefined) seg.sx = speed;
    if (intensity !== undefined) seg.ix = intensity;
    await this.setState({ seg: [seg] });
  }

  /**
   * Set palette by ID
   */
  async setPalette(paletteId: number): Promise<void> {
    await this.setState({ seg: [{ pal: paletteId }] });
  }

  /**
   * Load preset by ID
   */
  async loadPreset(presetId: number): Promise<void> {
    await this.setState({ ps: presetId });
  }

  /**
   * Save current state as preset
   */
  async savePreset(presetId: number, name?: string): Promise<void> {
    const body: Record<string, unknown> = { psave: presetId };
    if (name) {
      body.n = name;
    }
    await this.request('/json/state', 'POST', body);
  }

  /**
   * Flash a color temporarily
   */
  async flash(color: WledColor, durationMs = 500): Promise<void> {
    // Get current state
    const currentState = await this.getState();

    // Set flash color
    await this.setColor(color);

    // Restore after duration
    await new Promise((resolve) => setTimeout(resolve, durationMs));

    // Restore previous state
    await this.setState({
      seg: currentState.seg,
    });
  }

  /**
   * Play effect with color and restore
   */
  async playEffect(
    effectId: number,
    color: WledColor,
    durationMs = 2000,
    speed = 128,
    intensity = 128
  ): Promise<void> {
    const currentState = await this.getState();

    // Set effect
    const col: [number, number, number][] = [[color.r, color.g, color.b]];
    await this.setState({
      seg: [{ col, fx: effectId, sx: speed, ix: intensity }],
    });

    // Restore after duration
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    await this.setState({
      seg: currentState.seg,
    });
  }

  /**
   * Set transition time in 100ms units
   */
  async setTransition(transition: number): Promise<void> {
    await this.setState({ transition });
  }

  /**
   * Check if device is reachable
   */
  async ping(): Promise<boolean> {
    try {
      await this.getInfo();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Make HTTP request to WLED API
   */
  private async request(
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`WLED request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
