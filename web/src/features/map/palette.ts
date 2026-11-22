export type Rgb = [number, number, number]
export const rgb = {
  ink: [17, 11, 34],
  line: [59, 45, 107],
  bone: [255, 255, 255],
  mist: [201, 192, 234],
  dim: [156, 147, 191],
  gold: [255, 194, 61],
  coral: [255, 107, 90],
  kelp: [94, 220, 138],
  storm: [199, 166, 255],
} satisfies Record<string, Rgb>
/**
 * One color per squad member, recorder first. The validator puts the worst colorblind pair (pink and green) at ΔE 7.2,
 * which is only legal with labels, so tracked players always carry their name on the map.
 */
export const squadColors: Rgb[] = [rgb.gold, rgb.kelp, [111, 176, 255], [255, 122, 192]]
export const alpha = (color: Rgb, a: number): [number, number, number, number] => [...color, Math.round(a * 255)]
