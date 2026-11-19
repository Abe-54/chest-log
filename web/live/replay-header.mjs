import { open } from 'node:fs/promises'
import { HEADER_BYTES, parseHeader } from './parse-header.mjs'

export { parseHeader }

export async function readReplayHeader(path) {
  const file = await open(path, 'r')
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(HEADER_BYTES), 0, HEADER_BYTES, 0)
    return parseHeader(buffer.subarray(0, bytesRead))
  } finally {
    await file.close()
  }
}
