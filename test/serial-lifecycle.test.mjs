import test from 'node:test'
import assert from 'node:assert/strict'
import { createSerialQueue, closeSerialPort, writeSerialPort } from '../src/main/serial-lifecycle.js'

test('reconnect waits for close and a failed operation does not poison the serial queue', async () => {
  const queue = createSerialQueue(), events = []
  let finish
  const closing = queue(() => closeSerialPort({ close(cb) { events.push('closing'); finish = cb } }))
  const opening = queue(() => events.push('opened'))
  await Promise.resolve(); assert.deepEqual(events, ['closing'])
  finish(); await Promise.all([closing, opening]); assert.deepEqual(events, ['closing', 'opened'])
  await assert.rejects(queue(() => { throw new Error('open failed') }), /open failed/)
  assert.equal(await queue(() => 'recovered'), 'recovered')
})

test('write awaits callback and drain, and reports async write/close/drain errors', async () => {
  const events = []; let written, drained
  const pending = writeSerialPort({ write(bytes, cb) { events.push('write'); written = cb }, drain(cb) { events.push('drain'); drained = cb } }, Buffer.from([1]))
  assert.deepEqual(events, ['write']); written(); await Promise.resolve(); assert.deepEqual(events, ['write', 'drain'])
  drained(); await pending
  await assert.rejects(writeSerialPort({ write(bytes, cb) { queueMicrotask(() => cb(new Error('write failed'))) } }, Buffer.from([1])), /write failed/)
  await assert.rejects(writeSerialPort({ write(b, cb) { cb() }, drain(cb) { cb(new Error('drain failed')) } }, Buffer.from([1])), /drain failed/)
  await assert.rejects(closeSerialPort({ close(cb) { cb(new Error('close failed')) } }), /close failed/)
})
