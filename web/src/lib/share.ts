import { toast } from 'sonner'

export async function shareLink(title: string, url = location.href, copied = 'Anyone with it opens this exact view.') {
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title, url })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast('Link copied', { description: copied })
  } catch {
    toast('Copy this link', { description: url })
  }
}
