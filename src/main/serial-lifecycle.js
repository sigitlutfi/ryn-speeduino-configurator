// Serialize handle changes so Windows never sees an old COM handle closing
// concurrently with a replacement open. Rejections must not poison the queue.
export function createSerialQueue() {
  let tail = Promise.resolve()
  return action => {
    const result = tail.then(action)
    tail = result.catch(() => {})
    return result
  }
}

export function closeSerialPort(port) {
  if (!port || port.isOpen === false) return Promise.resolve()
  return new Promise((resolve, reject) => {
    try { port.close(error => error ? reject(error) : resolve()) }
    catch (error) { reject(error) }
  })
}

export async function writeSerialPort(port, bytes) {
  if (!port || port.isOpen === false) throw new Error('Not connected')
  await new Promise((resolve, reject) => {
    port.write(bytes, error => error ? reject(error) : resolve())
  })
  if (port.drain) await new Promise((resolve, reject) => port.drain(error => error ? reject(error) : resolve()))
}
