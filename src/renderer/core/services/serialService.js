/**
 * Serial Service - High-level API for ECU communication
 *
 * Handles:
 * - Modern protocol response parsing
 * - Handshake sequence
 * - Command/response matching
 * - Error handling
 * - Automatic retry for busy/timeout errors
 */

import { Buffer } from 'buffer';
import { ModernProtocolParser, ResponseStatus } from '../../../shared/protocol/response-parser.js';
import { validateResponse } from '../../../shared/protocol/response-utils.js';
import {
  formatWriteCommand,
  formatBurnCommand,
  formatCRCCommand,
  formatOutputChannelsCommand,
} from '../../../shared/protocol/ecu-commands.js';
import { decodeOutputChannels } from '../../../shared/protocol/output-channels.js';

function crc32(buffer) {
  const polynomial = 0xEDB88320;
  let crc = 0xFFFFFFFF;

  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? polynomial : 0);
    }
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export class SerialService {
  constructor() {
    this.parser = new ModernProtocolParser();
    this.isReady = false;
    this.pendingCommands = [];
    this.commandInFlightCount = 0;
    this.commandTail = Promise.resolve();
    this.sessionGeneration = 0;
    this.cancelTransactions = new Set();
    this.realtimeReadInFlight = false;
    this.outputChannelsPollTimer = null;
    this.outputChannelsPollConfig = null;
    this.outputChannelsPollRunning = false;
    this.pollGeneration = 0;
    this.activePollRead = null;
    this.outputChannelsSuspendCount = 0;

    // Setup parser event handlers
    this.parser.on('realtime', (data) => {
      // Forward realtime packets to all realtime listeners
      this._emitRealtime(data);
    });

    this.parser.on('response', ({ status, data }) => {
      // Match response to pending command
      if (this.pendingCommands.length > 0) {
        const { resolve } = this.pendingCommands.shift();
        resolve({ status, data: Buffer.from(data) });
      }
    });

    this.parser.on('error', ({ code, message, data }) => {
      // Reject pending command
      if (this.pendingCommands.length > 0) {
        const { reject } = this.pendingCommands.shift();
        reject(new Error(`${message} (0x${code.toString(16)})`));
      }
    });

    // Hook into window.serial.onData
    if (typeof window !== 'undefined' && window.serial) {
      this.unsubscribeParser = window.serial.onData((data) => {
        this.parser.feed(data);
      });
    }

    // Realtime listeners (separate from command responses)
    this.realtimeListeners = [];
  }

  async _waitForRealtimeIdle(timeout = 500) {
    const startedAt = Date.now();
    while (this.realtimeReadInFlight) {
      if (Date.now() - startedAt >= timeout) {
        throw new Error("Realtime polling busy");
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  async _runCommandTransaction(callback, realtime = false) {
    const generation = this.sessionGeneration;
    const previous = this.commandTail;
    let release;
    this.commandTail = new Promise(resolve => { release = resolve; });
    this.commandInFlightCount += 1;
    try {
      await previous;
      if (generation !== this.sessionGeneration) throw new Error('Serial session changed; reconnect and retry');
      if (!realtime) await this._waitForRealtimeIdle();
      if (generation !== this.sessionGeneration) throw new Error('Serial session changed; reconnect and retry');
      const result = await callback();
      if (generation !== this.sessionGeneration) throw new Error('Serial session changed; reconnect and retry');
      return result;
    } finally {
      if (generation === this.sessionGeneration) this.commandInFlightCount = Math.max(0, this.commandInFlightCount - 1);
      release();
    }
  }

  /**
   * Perform Speeduino-like connect probe:
   * boot delay -> flush RX -> legacy F -> legacy Q -> legacy S
   */
  async handshake() {
    const session = this.sessionGeneration;
    const check = () => { if (session !== this.sessionGeneration) throw new Error('Serial session changed during handshake'); };
    try {
      await this._bootDelay(2200);
      check();
      await this.flush();
      check();

      const probe = await this.sendLegacyCommand("F", {
        timeout: 2000,
        settleMs: 80,
        isComplete: (text) => text.length >= 3,
      });
      check();
      if (probe.trim() !== "002") {
        throw new Error(`Unexpected legacy probe response: ${probe}`);
      }

      const signature = await this.sendLegacyCommand("Q", {
        timeout: 2500,
        settleMs: 120,
        isComplete: (text) => /speeduino\s+\d/i.test(text),
      });

      check();
      let product = "";
      try {
        product = await this.sendLegacyCommand("S", {
          timeout: 2000,
          settleMs: 120,
          isComplete: (text) => /speeduino/i.test(text) && /\d/.test(text),
        });
      } catch (err) {
        check();
        console.warn("[Serial] Handshake product request failed:", err.message);
        product = "";
      }

      check();
      this.isReady = true;
      console.log("[Serial] Handshake complete", {
        probe: probe.trim(),
        signature: signature.trim(),
        product: product.trim(),
      });
      return {
        probe: probe.trim(),
        signature: signature.trim(),
        product: product.trim(),
      };
    } catch (err) {
      if (session === this.sessionGeneration) this.isReady = false;
      throw err;
    }
  }

  async _bootDelay(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async flush() {
    if (!window.serial?.flush) return;
    const result = await window.serial.flush();
    if (!result?.ok) {
      throw new Error(result?.error || "Flush failed");
    }
  }

  async sendLegacyCommand(command, options = {}) {
    return this._runCommandTransaction(async () => {
      const timeout = options.timeout ?? 2000;
      const isComplete = options.isComplete ?? ((text) => text.length > 0);
      const settleMs = options.settleMs ?? 100;
      return new Promise((resolve, reject) => {
        let buffer = Buffer.alloc(0);
        let unsubscribe = null;
        let settleTimer = null;
        let settled = false;
        const cleanup = () => {
          clearTimeout(timer);
          clearTimeout(settleTimer);
          unsubscribe?.();
          this.cancelTransactions.delete(fail);
        };
        const fail = error => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };
        const timer = setTimeout(() => fail(new Error(`Legacy command '${command}' timed out`)), timeout);
        const handleData = data => {
          if (settled) return;
          buffer = Buffer.concat([buffer, Buffer.from(data)]);
          const text = buffer.toString('ascii').replace(/\0/g, '').trim();
          if (text && isComplete(text)) {
            clearTimeout(settleTimer);
            settleTimer = setTimeout(() => {
              settled = true;
              cleanup();
              resolve(text);
            }, settleMs);
          }
        };
        this.cancelTransactions.add(fail);
        unsubscribe = window.serial.onData(handleData);
        Promise.resolve().then(() => {
          if (!settled) return window.serial.sendCommand(Buffer.from(command, 'ascii'));
        }).then(result => {
          if (!settled && !result?.ok) fail(new Error(result?.error || `Legacy send failed for ${command}`));
        }).catch(fail);
      });
    });
  }

  _tryParseWrappedResponse(buffer, strict = false) {
    if (buffer.length < 7) {
      return null;
    }

    const payloadLen = buffer.readUInt16BE(0);
    if (payloadLen <= 0 || payloadLen > 2048) {
      if (strict) throw new Error(`Invalid framed response length ${payloadLen}`);
      return null;
    }

    const totalLen = 2 + payloadLen + 4;
    if (buffer.length < totalLen) {
      return null;
    }

    const payload = buffer.slice(2, 2 + payloadLen);
    const receivedCRC = buffer.readUInt32BE(2 + payloadLen);
    const calculatedCRC = crc32(payload);
    if (receivedCRC !== calculatedCRC) {
      if (strict) throw new Error('CRC validation failed for framed response');
      return null;
    }

    return {
      totalLength: totalLen,
      status: payload[0],
      data: payload.slice(1),
    };
  }

  async sendHybridCommand(command, options = {}) {
    return this._runCommandTransaction(() => this._sendHybridCommand(command, options));
  }

  async _sendHybridCommand(command, options = {}) {
    const timeout = options.timeout ?? 3000;
    const rawExpectedLength = options.rawExpectedLength === null ? null : options.rawExpectedLength ?? 1;
    const successStatuses = options.successStatuses ?? [ResponseStatus.OK];
    const label = options.label ?? "command";
    // Modern commands have framed responses. Raw legacy replies must be
    // requested explicitly; a broken frame must never become a raw ACK.
    const responseMode = options.responseMode ?? 'framed';
    if (!['framed', 'raw'].includes(responseMode)) throw new Error('Unknown serial response mode');

    this.parser.reset();

    return new Promise((resolve, reject) => {
      let buffer = Buffer.alloc(0);
      let unsubscribe = null;
      let settled = false;

      const cleanup = () => {
        if (unsubscribe) unsubscribe();
        this.cancelTransactions.delete(fail);
      };

      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        this.parser.reset();
        reject(error);
      };

      const timer = setTimeout(() => fail(new Error(`${label} timeout`)), timeout);

      const finish = (status, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        this.parser.reset();

        if (!successStatuses.includes(status)) {
          reject(new Error(`Unexpected status 0x${status.toString(16)} during ${label}`));
          return;
        }

        resolve({ status, data: Buffer.from(data) });
      };

      const handleData = (bytes) => {
        if (settled) return;
        const chunk = Buffer.from(bytes);

        buffer = Buffer.concat([buffer, chunk]);

        try {
          if (responseMode === 'framed') {
            const wrapped = this._tryParseWrappedResponse(buffer, true);
            if (!wrapped) return;
            if (wrapped.totalLength !== buffer.length) throw new Error(`Unexpected trailing bytes in framed response during ${label}: received ${buffer.length}, frame ${wrapped.totalLength}, tail ${buffer.subarray(wrapped.totalLength, wrapped.totalLength + 8).toString('hex')}`);
            if (rawExpectedLength !== null && successStatuses.includes(wrapped.status) && wrapped.data.length !== rawExpectedLength - 1) {
              throw new Error(`Unexpected payload length during ${label}`);
            }
            finish(wrapped.status, wrapped.data);
          } else if (buffer.length && !successStatuses.includes(buffer[0])) {
            finish(buffer[0], Buffer.alloc(0));
          } else if (buffer.length >= rawExpectedLength) {
            if (buffer.length !== rawExpectedLength) throw new Error('Unexpected raw response length');
            finish(buffer[0], buffer.slice(1));
          }
        } catch (error) {
          fail(error);
        }
      };

      this.cancelTransactions.add(fail);
      unsubscribe = window.serial.onData(handleData);

      Promise.resolve().then(() => {
        if (!settled) return window.serial.sendCommand(command);
      }).then((result) => {
        if (!settled && !result?.ok) {
          fail(new Error(result.error || `Send failed during ${label}`));
        }
      }).catch(fail);
    });
  }

  /**
   * Send a command and wait for response
   * @param {Buffer} command - Command buffer (already wrapped with modern protocol)
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<{status: number, data: Buffer}>}
   */
  async sendCommand(command, timeout = 3000) {
    return this._runCommandTransaction(() => this._sendCommand(command, timeout));
  }

  async _sendCommand(command, timeout = 3000) {
    return this._sendHybridCommand(command, { timeout, rawExpectedLength: null, label: 'command' });
  }

  /**
   * Wait for next response (for handshake)
   */
  _waitForResponse(timeout) {
    return new Promise((resolve, reject) => {
      this.pendingCommands.push({ resolve, reject });

      setTimeout(() => {
        const idx = this.pendingCommands.findIndex(cmd => cmd.resolve === resolve);
        if (idx !== -1) {
          this.pendingCommands.splice(idx, 1);
          reject(new Error('Response timeout'));
        }
      }, timeout);
    });
  }

  /**
   * Send command with automatic retry for BUSY_ERR and timeouts
   * @param {Buffer} command - Command buffer
   * @param {number} maxRetries - Maximum retry attempts (default: 3)
   * @param {number} timeout - Timeout per attempt in ms (default: 3000)
   * @param {number} retryDelay - Delay between retries in ms (default: 150)
   * @returns {Promise<{status: number, data: Buffer}>}
   */
  async sendCommandWithRetry(command, maxRetries = 3, timeout = 3000, retryDelay = 150, label = "command") {
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.sendCommand(command, timeout);

        // Check if response is retryable error
        if (response.status === ResponseStatus.BUSY_ERR && attempt < maxRetries - 1) {
          console.log(`[Serial] ECU busy during ${label}, retry ${attempt + 1}/${maxRetries - 1}...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // Return response (success or non-retryable error)
        return response;

      } catch (err) {
        lastError = err;

        // Check if timeout error and should retry
        if (err.message.includes('timeout') && attempt < maxRetries - 1) {
          console.log(`[Serial] Timeout during ${label}, retry ${attempt + 1}/${maxRetries - 1}...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // Non-retryable error, throw immediately
        throw err;
      }
    }

    // Max retries exceeded
    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Read a framed page response and return raw page bytes.
   * This preserves the existing page-read behavior while moving transport
   * concerns out of the store layer.
   *
   * @param {Buffer} command - Wrapped read command buffer
   * @param {number} pageSize - Expected page payload size in bytes
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Buffer>}
   */
  async readPageBuffer(command, pageSize, timeout = 3000) {
    if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error('Invalid page read size');
    const response = await this.sendHybridCommand(command, {
      timeout,
      rawExpectedLength: pageSize + 1,
      label: `read page bytes=${pageSize}`,
    });
    return Buffer.from(response.data);
  }

  async readOutputChannels(parsedIni, options = {}) {
    return this._runCommandTransaction(() => this._readOutputChannels(parsedIni, options), true);
  }

  async _readOutputChannels(parsedIni, options = {}) {
    const ochTemplate = parsedIni?.outputChannels?.ochGetCommand;
    const blockSize = parsedIni?.outputChannels?.ochBlockSize;
    if (!ochTemplate || !blockSize) {
      throw new Error("Output channels are not available for this INI");
    }

    const command = formatOutputChannelsCommand(
      ochTemplate,
      options.offset ?? 0,
      options.length ?? blockSize,
      options.tsCanId ?? 0,
    );

    const expectedBytes = options.length ?? blockSize;
    if (!Number.isInteger(expectedBytes) || expectedBytes <= 0) throw new Error('Invalid output channels read size');
    // Already inside a transaction: do not queue another transaction behind it.
    const response = await this._sendHybridCommand(command, {
      timeout: options.timeout ?? 1200,
      rawExpectedLength: expectedBytes + 1,
      label: `output channels bytes=${expectedBytes}`,
    });
    const outputBuffer = response.data;

    return decodeOutputChannels(outputBuffer, parsedIni);
  }

  startOutputChannelsPolling(parsedIni, options = {}) {
    if (!parsedIni?.outputChannels?.ochGetCommand || !parsedIni?.outputChannels?.ochBlockSize) {
      this.stopOutputChannelsPolling();
      return false;
    }

    if (this.outputChannelsPollConfig?.parsedIni !== parsedIni) this.stopOutputChannelsPolling();

    this.outputChannelsPollConfig = {
      parsedIni,
      intervalMs: options.intervalMs ?? 120,
      tsCanId: options.tsCanId ?? 0,
    };

    if (this.outputChannelsSuspendCount > 0) return true;

    if (this.outputChannelsPollTimer) {
      return true;
    }

    const session = this.sessionGeneration;
    const poll = ++this.pollGeneration;
    const config = this.outputChannelsPollConfig;
    const tick = async () => {
      if (
        session !== this.sessionGeneration || poll !== this.pollGeneration ||
        this.outputChannelsSuspendCount > 0 ||
        this.outputChannelsPollRunning ||
        this.commandInFlightCount > 0 ||
        this.realtimeReadInFlight
      ) {
        return;
      }

      const read = {};
      this.activePollRead = read;
      this.outputChannelsPollRunning = true;
      this.realtimeReadInFlight = true;
      try {
        const realtime = await this.readOutputChannels(config.parsedIni, {
          tsCanId: config.tsCanId,
          timeout: 1200,
        });
        if (realtime && session === this.sessionGeneration && poll === this.pollGeneration) {
          this._emitRealtime(realtime, { ini: config.parsedIni });
        }
      } catch (error) {
        if (session === this.sessionGeneration && poll === this.pollGeneration) console.warn("[Serial] Output channels poll failed:", error.message);
      } finally {
        if (this.activePollRead === read) {
          this.activePollRead = null;
          this.realtimeReadInFlight = false;
          this.outputChannelsPollRunning = false;
        }
      }
    };

    this.outputChannelsPollTimer = setInterval(tick, this.outputChannelsPollConfig.intervalMs);
    tick();
    return true;
  }

  stopOutputChannelsPolling() {
    this.pollGeneration += 1;
    if (this.outputChannelsPollTimer) {
      clearInterval(this.outputChannelsPollTimer);
      this.outputChannelsPollTimer = null;
    }
    this.outputChannelsPollConfig = null;
  }

  suspendOutputChannelsPolling() {
    this.outputChannelsSuspendCount += 1;
    if (this.outputChannelsPollTimer) {
      clearInterval(this.outputChannelsPollTimer);
      this.outputChannelsPollTimer = null;
    }
  }

  async enterExclusiveMode(timeout = 1500) {
    const session = this.sessionGeneration;
    this.suspendOutputChannelsPolling();
    console.log("[Serial] Entering exclusive mode", {
      suspendCount: this.outputChannelsSuspendCount,
      outputChannelsPollRunning: this.outputChannelsPollRunning,
      realtimeReadInFlight: this.realtimeReadInFlight,
    });

    const startedAt = Date.now();
    while (this.outputChannelsPollRunning || this.realtimeReadInFlight) {
      if (Date.now() - startedAt >= timeout) {
        console.warn("[Serial] Exclusive mode entered with polling still busy", {
          timeout,
          outputChannelsPollRunning: this.outputChannelsPollRunning,
          realtimeReadInFlight: this.realtimeReadInFlight,
        });
        throw new Error('Realtime polling did not stop before exclusive operation');
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    if (session !== this.sessionGeneration) throw new Error('Serial session changed before exclusive operation');
    console.log("[Serial] Exclusive mode ready", {
      waitMs: Date.now() - startedAt,
      outputChannelsPollRunning: this.outputChannelsPollRunning,
      realtimeReadInFlight: this.realtimeReadInFlight,
    });
  }

  resumeOutputChannelsPolling(session = this.sessionGeneration) {
    if (session !== this.sessionGeneration) return;
    this.outputChannelsSuspendCount = Math.max(0, this.outputChannelsSuspendCount - 1);
    if (
      this.outputChannelsSuspendCount === 0 &&
      this.outputChannelsPollConfig &&
      !this.outputChannelsPollTimer
    ) {
      this.startOutputChannelsPolling(
        this.outputChannelsPollConfig.parsedIni,
        {
          intervalMs: this.outputChannelsPollConfig.intervalMs,
          tsCanId: this.outputChannelsPollConfig.tsCanId,
        },
      );
    }
  }

  /**
   * Write a region to ECU RAM and validate the response.
   * @returns {Promise<{status:number,data:Buffer}>}
   */
  async writePage(page, offset, length, value, dataType = "", options = {}) {
    const command = formatWriteCommand(page, offset, length, value, dataType);
    const response = await this.sendHybridCommand(
      command,
      {
        timeout: options.timeout ?? 3000,
        rawExpectedLength: 1,
        successStatuses: [ResponseStatus.OK],
        label: `write page=${page} offset=${offset} length=${length}`,
      },
    );
    return validateResponse(response, "write");
  }

  /**
   * Burn a page to EEPROM and validate BURN_OK.
   * @returns {Promise<{status:number,data:Buffer}>}
   */
  async burnPage(page, options = {}) {
    const command = formatBurnCommand(page);
    const response = await this.sendHybridCommand(
      command,
      {
        timeout: options.timeout ?? 4000,
        rawExpectedLength: 1,
        successStatuses: [ResponseStatus.BURN_OK, ResponseStatus.OK],
        label: `burn page=${page}`,
      },
    );
    return validateResponse(response, "burn");
  }

  /**
   * Read ECU page CRC32 using the modern 'd' command.
   * @returns {Promise<string>} Uppercase 8-char hex string
   */
  async readPageCRC(page, options = {}) {
    const command = formatCRCCommand(page);
    const response = await this.sendHybridCommand(
      command,
      {
        timeout: options.timeout ?? 3000,
        rawExpectedLength: 5,
        successStatuses: [ResponseStatus.OK],
        label: `crc page=${page}`,
      },
    );

    validateResponse(response, "crc");
    if (!response.data || response.data.length < 4) {
      throw new Error(`CRC response for page ${page} was too short`);
    }

    return response.data.readUInt32BE(0).toString(16).toUpperCase().padStart(8, "0");
  }

  /**
   * Register realtime data listener
   */
  onRealtime(callback) {
    this.realtimeListeners.push(callback);
  }

  /**
   * Remove realtime listener
   */
  offRealtime(callback) {
    this.realtimeListeners = this.realtimeListeners.filter(cb => cb !== callback);
  }

  /**
   * Emit realtime data to all listeners
   */
  _emitRealtime(data, source) {
    this.realtimeListeners.forEach(cb => cb(data, source));
  }

  /**
   * Enable raw data mode for reading unwrapped page data
   * @param {number} expectedBytes - Expected number of bytes
   * @param {Function} callback - Callback for raw data chunks
   * @returns {Function} Cleanup function to call when done
   */
  enableRawMode(expectedBytes, callback) {
    console.log(`[serialService] Enabling raw mode, expecting ${expectedBytes} bytes`);
    this.parser.enableRawMode(expectedBytes);
    this.parser.on('rawData', callback);

    // Return cleanup function
    return () => {
      console.log(`[serialService] Disabling raw mode`);
      this.parser.off('rawData', callback);
      this.parser.disableRawMode();
    };
  }

  /**
   * Reset service state
   */
  reset() {
    this.sessionGeneration += 1;
    for (const cancel of [...this.cancelTransactions]) cancel(new Error('Serial session changed; reconnect and retry'));
    for (const pending of this.pendingCommands.splice(0)) pending.reject(new Error('Serial session changed; reconnect and retry'));
    this.parser.reset();
    this.isReady = false;
    this.pendingCommands = [];
    this.commandInFlightCount = 0;
    this.stopOutputChannelsPolling();
    this.activePollRead = null;
    this.outputChannelsPollRunning = false;
    this.realtimeReadInFlight = false;
    this.outputChannelsSuspendCount = 0;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
    this.unsubscribeParser?.();
    this.unsubscribeParser = null;
    this.stopOutputChannelsPolling();
    this.parser.offAll();
    this.realtimeListeners = [];
    this.pendingCommands = [];
    this.isReady = false;
    this.commandInFlightCount = 0;
    this.outputChannelsSuspendCount = 0;
  }
}

// Singleton instance
export const serialService = new SerialService();

// Vite replaces this module during development. Retire its listeners, queued
// commands and timers before a replacement instance can use the same USB port.
if (import.meta.hot) import.meta.hot.dispose(() => serialService.destroy());
