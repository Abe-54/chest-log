import { beforeEach, describe, expect, it, vi } from 'vitest'

const imports = vi.hoisted(() => ({ release: () => {}, calls: 0 }))

vi.mock('./db', () => ({ allReplays: async () => [] }))
vi.mock('./unseen', () => ({ unseenReplays: async (files: File[]) => files }))
vi.mock('./import', () => ({
  rememberedFolder: async () => undefined,
  filesIn: async () => [new File(['x'], 'a.replay')],
  importReplays: () => {
    imports.calls++
    return new Promise(resolve => { imports.release = () => resolve({ added: 1, before: 0, total: 1 }) })
  },
}))

const { forgetWatching, startWatching, watchStore, whenImported } = await import('./watch')

const folder = (name: string) => ({ name, queryPermission: async () => 'granted' }) as unknown as FileSystemDirectoryHandle
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

describe('watching the Demos folder', () => {
  beforeEach(() => { imports.calls = 0 })

  it('does not announce an import that finishes after the library is deleted', async () => {
    const announced = vi.fn()
    whenImported(announced)
    startWatching(folder('Demos'))
    await tick()
    expect(imports.calls).toBe(1)
    const forgotten = forgetWatching()
    imports.release()
    await forgotten
    expect(announced).not.toHaveBeenCalled()
    expect(watchStore.state).toEqual({ phase: 'off' })
  })
})
