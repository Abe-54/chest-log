import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseHeader, readReplayHeader } from './replay-header.mjs'

const replays = fileURLToPath(new URL('../../replays/', import.meta.url))
const names = (await readdir(replays)).filter(name => name.endsWith('.replay'))

describe('replay header', () => {
  it.each(names)('%s reads as a finished, keyed replay', async name => {
    const header = await readReplayHeader(replays + name)
    expect(header).toMatchObject({ live: false, encrypted: true, keyLength: 32 })
    expect(header.lengthMs).toBeGreaterThan(0)
  })

  it('gives every archived match its own recording time, so a renamed copy is recognised', async () => {
    const stamps = await Promise.all(names.map(async name => (await readReplayHeader(replays + name)).recordedAt))
    expect(stamps.every(Boolean)).toBe(true)
    expect(new Set(stamps).size).toBe(names.length)
  })

  it('reads a recording replay as live', async () => {
    const { readFile } = await import('node:fs/promises')
    const bytes = Buffer.from((await readFile(replays + names[0])).subarray(0, 4096))
    const finished = parseHeader(bytes)
    const nameLength = -bytes.readInt32LE(44)
    bytes.writeUInt32LE(1, 48 + nameLength * 2)
    expect(parseHeader(bytes)).toEqual({ ...finished, live: true })
  })

  it('rejects files that are not Unreal replays', () => {
    expect(() => parseHeader(Buffer.alloc(64))).toThrow('not an Unreal replay')
  })
})
