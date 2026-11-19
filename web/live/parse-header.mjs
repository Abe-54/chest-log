const MAGIC = 0x1ca2e27f
const CUSTOM_VERSIONS = 7
const ENCRYPTION = 6
const RECORDED_TIMESTAMP = 3
const COMPRESSION = 2

/** How many leading bytes of a replay file hold the info block. */
export const HEADER_BYTES = 4096

/**
 * Parses the info block Unreal writes at the start of a local replay. See LocalFileNetworkReplayStreaming.cpp
 * ReadReplayInfo. Runs in Node and in the browser.
 * @param {Uint8Array} bytes
 * @returns {{ lengthMs: number, live: boolean, recordedAt: string | null, encrypted: boolean, keyLength: number }}
 */
export function parseHeader(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 0
  const u32 = () => { const value = view.getUint32(at, true); at += 4; return value }
  const i32 = () => { const value = view.getInt32(at, true); at += 4; return value }
  if (bytes.byteLength < 8 || u32() !== MAGIC) throw new Error('not an Unreal replay')
  const version = u32()
  if (version >= CUSTOM_VERSIONS) { const count = i32(); at += count * 20 }
  const lengthMs = u32()
  at += 8
  const nameLength = i32()
  at += nameLength < 0 ? -nameLength * 2 : nameLength
  const live = u32() !== 0
  // When recording started, in .NET ticks. A renamed or copied replay keeps it, so it identifies the match.
  let recordedAt = null
  if (version >= RECORDED_TIMESTAMP) { recordedAt = view.getBigInt64(at, true).toString(); at += 8 }
  if (version >= COMPRESSION) at += 4
  let encrypted = false
  let keyLength = 0
  if (version >= ENCRYPTION) {
    encrypted = u32() !== 0
    keyLength = u32()
  }
  return { lengthMs, live, recordedAt, encrypted, keyLength }
}
