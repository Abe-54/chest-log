export const clock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
export const decimal = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? '–' : value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const whole = (value: number | null | undefined) => value === null || value === undefined ? '–' : Math.round(value).toLocaleString()
export const ordinal = (n: number) => {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${tail}`
}
export const placeLabel = (placement: number | null) => placement === null ? 'No result' : placement === 1 ? 'Victory' : `#${placement}`
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
export const timeOfDay = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
export const dateTime = (iso: string) => `${shortDate(iso)} · ${timeOfDay(iso)}`
export const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`
