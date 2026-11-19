import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const compressible = /\.(js|css|html|json|svg|txt)$/

/** Writes .br and .gz siblings for every compressible file under dir, so sirv can serve them without compressing per request. */
export async function compressTree(dir) {
  const totals = { files: 0, before: 0, after: 0 }
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name)
      if (entry.isDirectory()) await walk(file)
      else if (compressible.test(entry.name)) {
        const body = await readFile(file)
        if (body.length < 1024) continue
        const br = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: body.length } })
        await writeFile(file + '.br', br)
        await writeFile(file + '.gz', gzipSync(body, { level: 9 }))
        totals.files++
        totals.before += body.length
        totals.after += br.length
      }
    }
  }
  await walk(dir)
  return totals
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { files, before, after } = await compressTree(fileURLToPath(new URL('../dist/', import.meta.url)))
  console.log(`precompressed ${files} files: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB brotli`)
}
