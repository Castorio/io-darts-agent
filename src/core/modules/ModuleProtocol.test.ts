import { describe, it, expect } from 'vitest';
import { ModuleProtocol } from './ModuleProtocol.js';
import type { IPCMessage, InitPayload, EventPayload } from '../../types/modules.js';
import type { ParsedEvent } from '../../types/index.js';

describe('ModuleProtocol', () => {
  describe('createMessage()', () => {
    it('should create a message with correct structure', () => {
      const message = ModuleProtocol.createMessage('ping', {});

      expect(message).toHaveProperty('id');
      expect(message.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(message.type).toBe('ping');
      expect(message.timestamp).toBeGreaterThan(0);
      expect(message.payload).toEqual({});
    });

    it('should create unique IDs for each message', () => {
      const msg1 = ModuleProtocol.createMessage('ping', {});
      const msg2 = ModuleProtocol.createMessage('ping', {});

      expect(msg1.id).not.toBe(msg2.id);
    });
  });

  describe('serialize() / parse()', () => {
    it('should serialize and parse a message correctly', () => {
      const original = ModuleProtocol.createMessage('ping', { test: 'data' });
      const serialized = ModuleProtocol.serialize(original);

      expect(serialized).toContain('\n');
      expect(serialized).toContain('"type":"ping"');

      const { messages, remainder } = ModuleProtocol.parse(serialized);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(original);
      expect(remainder).toBe('');
    });

    it('should handle multiple messages in buffer', () => {
      const msg1 = ModuleProtocol.createMessage('ping', {});
      const msg2 = ModuleProtocol.createMessage('pong', {});

      const buffer = ModuleProtocol.serialize(msg1) + ModuleProtocol.serialize(msg2);
      const { messages, remainder } = ModuleProtocol.parse(buffer);

      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('ping');
      expect(messages[1].type).toBe('pong');
      expect(remainder).toBe('');
    });

    it('should handle partial messages', () => {
      const msg = ModuleProtocol.createMessage('ping', {});
      const serialized = ModuleProtocol.serialize(msg);
      const partial = serialized.slice(0, -5); // Cut off end

      const { messages, remainder } = ModuleProtocol.parse(partial);

      expect(messages).toHaveLength(0);
      expect(remainder.length).toBeGreaterThan(0);
    });

    it('should handle concatenated buffers with partial', () => {
      const msg1 = ModuleProtocol.createMessage('ping', {});
      const msg2 = ModuleProtocol.createMessage('pong', {});

      const buffer1 = ModuleProtocol.serialize(msg1);
      const buffer2 = ModuleProtocol.serialize(msg2);

      // First chunk: complete msg1 + partial msg2
      const chunk1 = buffer1 + buffer2.slice(0, 10);
      const result1 = ModuleProtocol.parse(chunk1);

      expect(result1.messages).toHaveLength(1);
      expect(result1.messages[0].type).toBe('ping');
      expect(result1.remainder.length).toBeGreaterThan(0);

      // Second chunk: remainder + rest of msg2
      const chunk2 = result1.remainder + buffer2.slice(10);
      const result2 = ModuleProtocol.parse(chunk2);

      expect(result2.messages).toHaveLength(1);
      expect(result2.messages[0].type).toBe('pong');
      expect(result2.remainder).toBe('');
    });

    it('should skip invalid JSON', () => {
      const validMsg = ModuleProtocol.createMessage('ping', {});
      const buffer = 'invalid json\n' + ModuleProtocol.serialize(validMsg);

      const { messages } = ModuleProtocol.parse(buffer);

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('ping');
    });
  });

  describe('isValidMessage()', () => {
    it('should return true for valid message', () => {
      const msg = ModuleProtocol.createMessage('ping', {});
      expect(ModuleProtocol.isValidMessage(msg)).toBe(true);
    });

    it('should return false for null', () => {
      expect(ModuleProtocol.isValidMessage(null)).toBe(false);
    });

    it('should return false for missing id', () => {
      expect(
        ModuleProtocol.isValidMessage({ type: 'ping', timestamp: 1, payload: {} })
      ).toBe(false);
    });

    it('should return false for missing type', () => {
      expect(
        ModuleProtocol.isValidMessage({ id: '123', timestamp: 1, payload: {} })
      ).toBe(false);
    });

    it('should return false for missing timestamp', () => {
      expect(
        ModuleProtocol.isValidMessage({ id: '123', type: 'ping', payload: {} })
      ).toBe(false);
    });

    it('should return false for missing payload', () => {
      expect(
        ModuleProtocol.isValidMessage({ id: '123', type: 'ping', timestamp: 1 })
      ).toBe(false);
    });
  });

  describe('Hub → Module Message Factories', () => {
    describe('createInit()', () => {
      it('should create init message with correct payload', () => {
        const msg = ModuleProtocol.createInit(
          'test-module',
          { setting: 'value' },
          ['throw.detected', 'match.start'],
          '1.0.0'
        );

        expect(msg.type).toBe('init');
        expect(msg.payload.moduleId).toBe('test-module');
        expect(msg.payload.config).toEqual({ setting: 'value' });
        expect(msg.payload.subscribedEvents).toEqual(['throw.detected', 'match.start']);
        expect(msg.payload.hubVersion).toBe('1.0.0');
      });
    });

    describe('createEvent()', () => {
      it('should create event message with parsed event', () => {
        const event: ParsedEvent = {
          type: 'throw.detected',
          timestamp: new Date(),
          raw: { channel: 'test', topic: 'test', data: {} },
          data: { segment: { name: 'T20' } },
        };

        const msg = ModuleProtocol.createEvent(event);

        expect(msg.type).toBe('event');
        expect(msg.payload.event).toEqual(event);
      });
    });

    describe('createConfigUpdate()', () => {
      it('should create config update message', () => {
        const msg = ModuleProtocol.createConfigUpdate(
          { setting1: 'new', setting2: 'value' },
          ['setting1']
        );

        expect(msg.type).toBe('config.update');
        expect(msg.payload.config).toEqual({ setting1: 'new', setting2: 'value' });
        expect(msg.payload.changedKeys).toEqual(['setting1']);
      });
    });

    describe('createShutdown()', () => {
      it('should create shutdown message with default grace period', () => {
        const msg = ModuleProtocol.createShutdown('user');

        expect(msg.type).toBe('shutdown');
        expect(msg.payload.reason).toBe('user');
        expect(msg.payload.gracePeriodMs).toBe(5000);
      });

      it('should create shutdown message with custom grace period', () => {
        const msg = ModuleProtocol.createShutdown('hub-shutdown', 10000);

        expect(msg.payload.gracePeriodMs).toBe(10000);
      });
    });

    describe('createPing()', () => {
      it('should create ping message', () => {
        const msg = ModuleProtocol.createPing();

        expect(msg.type).toBe('ping');
        expect(msg.payload).toEqual({});
      });
    });
  });

  describe('Module → Hub Message Factories', () => {
    describe('createReady()', () => {
      it('should create ready message', () => {
        const msg = ModuleProtocol.createReady('test-module', '1.0.0', ['feature1']);

        expect(msg.type).toBe('ready');
        expect(msg.payload.moduleId).toBe('test-module');
        expect(msg.payload.version).toBe('1.0.0');
        expect(msg.payload.capabilities).toEqual(['feature1']);
      });
    });

    describe('createStatus()', () => {
      it('should create status message', () => {
        const msg = ModuleProtocol.createStatus('running', 'All good', { uptime: 100 });

        expect(msg.type).toBe('status');
        expect(msg.payload.status).toBe('running');
        expect(msg.payload.message).toBe('All good');
        expect(msg.payload.data).toEqual({ uptime: 100 });
      });
    });

    describe('createLog()', () => {
      it('should create log message', () => {
        const msg = ModuleProtocol.createLog('info', 'Test message', { key: 'value' });

        expect(msg.type).toBe('log');
        expect(msg.payload.level).toBe('info');
        expect(msg.payload.message).toBe('Test message');
        expect(msg.payload.context).toEqual({ key: 'value' });
      });
    });

    describe('createError()', () => {
      it('should create error message', () => {
        const msg = ModuleProtocol.createError('ERR_001', 'Something failed', true, 'stack trace');

        expect(msg.type).toBe('error');
        expect(msg.payload.code).toBe('ERR_001');
        expect(msg.payload.message).toBe('Something failed');
        expect(msg.payload.fatal).toBe(true);
        expect(msg.payload.stack).toBe('stack trace');
      });
    });

    describe('createRequest()', () => {
      it('should create request message', () => {
        const msg = ModuleProtocol.createRequest('getData', { id: 123 });

        expect(msg.type).toBe('request');
        expect(msg.payload.action).toBe('getData');
        expect(msg.payload.data).toEqual({ id: 123 });
      });
    });

    describe('createPong()', () => {
      it('should create pong message', () => {
        const msg = ModuleProtocol.createPong();

        expect(msg.type).toBe('pong');
        expect(msg.payload).toEqual({});
      });
    });
  });

  describe('Type Guards', () => {
    it('should identify init message', () => {
      const msg = ModuleProtocol.createInit('test', {}, []);
      expect(ModuleProtocol.isInitMessage(msg)).toBe(true);
      expect(ModuleProtocol.isEventMessage(msg)).toBe(false);
    });

    it('should identify event message', () => {
      const event: ParsedEvent = {
        type: 'throw.detected',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'test', data: {} },
        data: {},
      };
      const msg = ModuleProtocol.createEvent(event);
      expect(ModuleProtocol.isEventMessage(msg)).toBe(true);
    });

    it('should identify config update message', () => {
      const msg = ModuleProtocol.createConfigUpdate({}, []);
      expect(ModuleProtocol.isConfigUpdateMessage(msg)).toBe(true);
    });

    it('should identify shutdown message', () => {
      const msg = ModuleProtocol.createShutdown('user');
      expect(ModuleProtocol.isShutdownMessage(msg)).toBe(true);
    });

    it('should identify ready message', () => {
      const msg = ModuleProtocol.createReady('test', '1.0.0');
      expect(ModuleProtocol.isReadyMessage(msg)).toBe(true);
    });

    it('should identify status message', () => {
      const msg = ModuleProtocol.createStatus('running');
      expect(ModuleProtocol.isStatusMessage(msg)).toBe(true);
    });

    it('should identify log message', () => {
      const msg = ModuleProtocol.createLog('info', 'test');
      expect(ModuleProtocol.isLogMessage(msg)).toBe(true);
    });

    it('should identify error message', () => {
      const msg = ModuleProtocol.createError('ERR', 'test');
      expect(ModuleProtocol.isErrorMessage(msg)).toBe(true);
    });

    it('should identify request message', () => {
      const msg = ModuleProtocol.createRequest('action');
      expect(ModuleProtocol.isRequestMessage(msg)).toBe(true);
    });

    it('should identify ping message', () => {
      const msg = ModuleProtocol.createPing();
      expect(ModuleProtocol.isPingMessage(msg)).toBe(true);
    });

    it('should identify pong message', () => {
      const msg = ModuleProtocol.createPong();
      expect(ModuleProtocol.isPongMessage(msg)).toBe(true);
    });
  });
});
