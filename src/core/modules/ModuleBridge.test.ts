import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as net from 'net';
import * as fs from 'fs';
import { ModuleBridge } from './ModuleBridge.js';
import { ModuleProtocol } from './ModuleProtocol.js';
import type { IPCMessage, ErrorPayload } from '../../types/modules.js';

const TEST_MODULE_ID = 'test-module';

describe('ModuleBridge', () => {
  let bridge: ModuleBridge;
  let socketPath: string;

  beforeEach(() => {
    const tmpDir = process.env.TMPDIR || '/tmp';
    socketPath = `${tmpDir}/autodarts-hub-test-${Date.now()}.sock`;
    bridge = new ModuleBridge(TEST_MODULE_ID, { socketPath });
  });

  afterEach(async () => {
    await bridge.stop();
    // Clean up socket file
    try {
      if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
      }
    } catch {
      // Ignore
    }
  });

  describe('constructor', () => {
    it('should create bridge with default options', () => {
      const defaultBridge = new ModuleBridge('test');
      expect(defaultBridge.getSocketPath()).toContain('autodarts-hub-test');
    });

    it('should create bridge with custom socket path', () => {
      expect(bridge.getSocketPath()).toBe(socketPath);
    });
  });

  describe('start() / stop()', () => {
    it('should start the IPC server', async () => {
      const listeningHandler = vi.fn();
      bridge.on('listening', listeningHandler);

      await bridge.start();

      expect(listeningHandler).toHaveBeenCalledWith(socketPath);
      expect(fs.existsSync(socketPath)).toBe(true);
    });

    it('should throw if started twice', async () => {
      await bridge.start();
      await expect(bridge.start()).rejects.toThrow('Bridge already started');
    });

    it('should stop the server and clean up socket', async () => {
      await bridge.start();
      await bridge.stop();

      expect(fs.existsSync(socketPath)).toBe(false);
    });

    it('does not try to remove a stale socket file on Windows before starting (named pipes are not filesystem entries there)', async () => {
      const originalPlatform = process.platform;
      // A stray file left at the socket path (e.g. from an unclean previous
      // exit) - start() cleans this up before listen() on real platforms.
      fs.writeFileSync(socketPath, '');
      bridge.on('error', () => {
        // A real caller always attaches one; EventEmitter throws on an
        // unhandled 'error' event otherwise, which start()'s own emit would
        // trigger here and mask the rejection this test checks for.
      });

      Object.defineProperty(process, 'platform', { value: 'win32' });
      try {
        // Cleanup skipped -> the stale file is still in the way, so
        // binding to it fails, proving the unlink call never happened.
        await expect(bridge.start()).rejects.toThrow();
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });
  });

  describe('Client Connection', () => {
    it('should accept client connection', async () => {
      await bridge.start();

      const stateChangeHandler = vi.fn();
      bridge.on('stateChange', stateChangeHandler);

      // Connect a client
      const client = net.createConnection(socketPath);

      await new Promise<void>((resolve) => {
        client.on('connect', resolve);
      });

      // Wait for state change
      await new Promise((r) => setTimeout(r, 50));

      expect(stateChangeHandler).toHaveBeenCalledWith('connecting', 'disconnected');

      client.destroy();
    });

    it('should handle client disconnect', async () => {
      await bridge.start();

      const disconnectedHandler = vi.fn();
      bridge.on('disconnected', disconnectedHandler);

      // Connect and then disconnect
      const client = net.createConnection(socketPath);
      await new Promise<void>((resolve) => {
        client.on('connect', resolve);
      });

      client.destroy();

      await new Promise((r) => setTimeout(r, 50));

      expect(disconnectedHandler).toHaveBeenCalled();
      expect(bridge.isConnected()).toBe(false);
    });

    it('should only accept one client', async () => {
      await bridge.start();

      const client1 = net.createConnection(socketPath);
      await new Promise<void>((resolve) => {
        client1.on('connect', resolve);
      });

      // Second client should be rejected
      const client2 = net.createConnection(socketPath);
      const closeHandler = vi.fn();
      client2.on('close', closeHandler);

      await new Promise((r) => setTimeout(r, 100));

      expect(closeHandler).toHaveBeenCalled();

      client1.destroy();
    });
  });

  describe('Message Handling', () => {
    let client: net.Socket;

    beforeEach(async () => {
      await bridge.start();
      client = net.createConnection(socketPath);
      await new Promise<void>((resolve) => {
        client.on('connect', resolve);
      });
    });

    afterEach(() => {
      client.destroy();
    });

    it('should parse incoming messages', async () => {
      const messageHandler = vi.fn<[IPCMessage], void>();
      bridge.on('message', messageHandler);

      const msg = ModuleProtocol.createReady(TEST_MODULE_ID, '1.0.0');
      client.write(ModuleProtocol.serialize(msg));

      await new Promise((r) => setTimeout(r, 50));

      expect(messageHandler).toHaveBeenCalled();
      expect(messageHandler.mock.calls[0][0].type).toBe('ready');
    });

    it('should emit ready event and set connected state', async () => {
      const readyHandler = vi.fn();
      bridge.on('ready', readyHandler);

      const msg = ModuleProtocol.createReady(TEST_MODULE_ID, '1.0.0', ['feature1']);
      client.write(ModuleProtocol.serialize(msg));

      await new Promise((r) => setTimeout(r, 50));

      expect(readyHandler).toHaveBeenCalledWith({
        moduleId: TEST_MODULE_ID,
        version: '1.0.0',
        capabilities: ['feature1'],
      });
      expect(bridge.isConnected()).toBe(true);
    });

    it('should emit status event', async () => {
      const statusHandler = vi.fn();
      bridge.on('status', statusHandler);

      // First send ready
      const readyMsg = ModuleProtocol.createReady(TEST_MODULE_ID, '1.0.0');
      client.write(ModuleProtocol.serialize(readyMsg));
      await new Promise((r) => setTimeout(r, 50));

      // Then send status
      const statusMsg = ModuleProtocol.createStatus('running', 'All good');
      client.write(ModuleProtocol.serialize(statusMsg));
      await new Promise((r) => setTimeout(r, 50));

      expect(statusHandler).toHaveBeenCalledWith({
        status: 'running',
        message: 'All good',
        data: undefined,
      });
    });

    it('should emit log event', async () => {
      const logHandler = vi.fn();
      bridge.on('log', logHandler);

      const msg = ModuleProtocol.createLog('info', 'Test message', { key: 'value' });
      client.write(ModuleProtocol.serialize(msg));

      await new Promise((r) => setTimeout(r, 50));

      expect(logHandler).toHaveBeenCalledWith({
        level: 'info',
        message: 'Test message',
        context: { key: 'value' },
        moduleId: TEST_MODULE_ID,
      });
    });

    it('should emit moduleError event', async () => {
      const errorHandler = vi.fn<[ErrorPayload], void>();
      bridge.on('moduleError', errorHandler);

      const msg = ModuleProtocol.createError('ERR_001', 'Something failed', false);
      client.write(ModuleProtocol.serialize(msg));

      await new Promise((r) => setTimeout(r, 50));

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0].code).toBe('ERR_001');
    });

    it('should emit fatalError event for fatal errors', async () => {
      const fatalHandler = vi.fn();
      bridge.on('fatalError', fatalHandler);

      const msg = ModuleProtocol.createError('FATAL', 'Critical error', true);
      client.write(ModuleProtocol.serialize(msg));

      await new Promise((r) => setTimeout(r, 50));

      expect(fatalHandler).toHaveBeenCalled();
    });

    it('should respond to ping with pong', async () => {
      // Setup data handler to collect messages
      const receivedMessages: string[] = [];
      client.on('data', (data) => {
        receivedMessages.push(data.toString());
      });

      // Send ready first to establish connection state
      const readyMsg = ModuleProtocol.createReady(TEST_MODULE_ID, '1.0.0');
      client.write(ModuleProtocol.serialize(readyMsg));
      await new Promise((r) => setTimeout(r, 50));

      // Now send ping - bridge should respond with pong
      const pingMsg = ModuleProtocol.createPing();
      client.write(ModuleProtocol.serialize(pingMsg));

      await new Promise((r) => setTimeout(r, 100));

      const allReceived = receivedMessages.join('');
      expect(allReceived).toContain('"type":"pong"');
    });
  });

  describe('Sending Messages', () => {
    let client: net.Socket;
    let receivedData: string;

    beforeEach(async () => {
      await bridge.start();
      client = net.createConnection(socketPath);
      receivedData = '';

      client.on('data', (data) => {
        receivedData += data.toString();
      });

      await new Promise<void>((resolve) => {
        client.on('connect', resolve);
      });

      // Send ready to set connected state
      const readyMsg = ModuleProtocol.createReady(TEST_MODULE_ID, '1.0.0');
      client.write(ModuleProtocol.serialize(readyMsg));
      await new Promise((r) => setTimeout(r, 50));
    });

    afterEach(() => {
      client.destroy();
    });

    it('should send event to module', async () => {
      const event = {
        type: 'throw.detected' as const,
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: { segment: { name: 'T20' } },
      };

      const result = bridge.sendEvent(event);
      await new Promise((r) => setTimeout(r, 50));

      expect(result).toBe(true);
      expect(receivedData).toContain('"type":"event"');
    });

    it('should send init message', async () => {
      const result = bridge.sendInit({ setting: 'value' }, ['throw.detected']);
      await new Promise((r) => setTimeout(r, 50));

      expect(result).toBe(true);
      expect(receivedData).toContain('"type":"init"');
      expect(receivedData).toContain('throw.detected');
    });

    it('should send config update', async () => {
      const result = bridge.sendConfigUpdate({ setting: 'new' }, ['setting']);
      await new Promise((r) => setTimeout(r, 50));

      expect(result).toBe(true);
      expect(receivedData).toContain('"type":"config.update"');
    });

    it('should send shutdown signal', async () => {
      const result = bridge.sendShutdown('user', 3000);
      await new Promise((r) => setTimeout(r, 50));

      expect(result).toBe(true);
      expect(receivedData).toContain('"type":"shutdown"');
      expect(receivedData).toContain('"reason":"user"');
    });

    it('should return false when not connected', async () => {
      await bridge.stop();
      bridge = new ModuleBridge(TEST_MODULE_ID, { socketPath });

      const result = bridge.sendEvent({
        type: 'throw.detected',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {},
      });

      expect(result).toBe(false);
    });
  });

  describe('getConnectionState()', () => {
    it('should return disconnected initially', () => {
      expect(bridge.getConnectionState()).toBe('disconnected');
    });

    it('should return connecting when client connects', async () => {
      await bridge.start();

      const client = net.createConnection(socketPath);
      await new Promise<void>((resolve) => {
        client.on('connect', resolve);
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(bridge.getConnectionState()).toBe('connecting');

      client.destroy();
    });

    it('should return connected after ready message', async () => {
      await bridge.start();

      const client = net.createConnection(socketPath);
      await new Promise<void>((resolve) => {
        client.on('connect', resolve);
      });

      const readyMsg = ModuleProtocol.createReady(TEST_MODULE_ID, '1.0.0');
      client.write(ModuleProtocol.serialize(readyMsg));

      await new Promise((r) => setTimeout(r, 50));

      expect(bridge.getConnectionState()).toBe('connected');

      client.destroy();
    });
  });

  describe('connection reset by the module', () => {
    it('does not throw when nobody listens for errors and reports the disconnect', async () => {
      await bridge.start();
      const socket = net.createConnection(socketPath);
      await new Promise<void>((resolve) => socket.on('connect', resolve));
      await new Promise((r) => setTimeout(r, 20));

      const disconnected = new Promise<void>((resolve) => bridge.once('disconnected', () => resolve()));
      // What Linux reports when the module process dies mid-connection
      const serverSide = (bridge as unknown as { client: net.Socket }).client;
      expect(() => serverSide.emit('error', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))).not.toThrow();
      socket.destroy();

      await disconnected;
    });
  });
});
