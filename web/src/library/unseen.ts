import { HEADER_BYTES, parseHeader } from '../../live/parse-header.mjs'

/**
 * The files that are neither read before nor still being recorded. A file counts as read when the library holds a
 * record with the same name and size, so a check with nothing new reads no replay at all.
 */
export async function unseenReplays(files: File[], known: Set<string>) {
  const fresh: File[] = []
  for (const file of files) {
    if (known.has(`${file.name}:${file.size}`)) continue
    try {
      // Fortnite is still writing this one; a later check picks it up once the match is over.
      if (parseHeader(new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer())).live) continue
    } catch {
      // Not a readable replay. Importing it records the failure, so it is not tried again.
    }
    fresh.push(file)
  }
  return fresh
}
