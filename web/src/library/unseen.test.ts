import { describe, expect, it } from 'vitest'
import { HEADER_BYTES } from '../../live/parse-header.mjs'
import { unseenReplays } from './unseen'

/** A replay file's info block, as much of it as the header parser reads. */
function replay(name: string, { live = false, size = 100 } = {}) {
  const bytes = new Uint8Array(Math.max(size, HEADER_BYTES))
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x1ca2e27f, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, 60_000, true)
  view.setUint32(24, live ? 1 : 0, true)
  return new File([bytes.subarray(0, size === 100 ? HEADER_BYTES : size)], name)
}

describe('unseen replays', () => {
  it('skips files already read, matched by name and size', async () => {
    const seen = replay('seen.replay')
    const grown = replay('grown.replay', { size: HEADER_BYTES + 10 })
    const known = new Set([`${seen.name}:${seen.size}`, `grown.replay:${HEADER_BYTES}`])
    expect((await unseenReplays([seen, grown, replay('new.replay')], known)).map(file => file.name)).toEqual(['grown.replay', 'new.replay'])
  })

  it('waits for a match that is still being recorded', async () => {
    expect(await unseenReplays([replay('now.replay', { live: true })], new Set())).toEqual([])
  })

  it('passes a file that is not a replay on, so the failure is recorded once', async () => {
    const junk = new File([new Uint8Array(64)], 'junk.replay')
    expect(await unseenReplays([junk], new Set())).toEqual([junk])
  })
})
