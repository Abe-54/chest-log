export type Rgb = [number, number, number]
export const rgb = {
  ink: [7, 16, 24],
  line: [40, 55, 68],
  bone: [243, 238, 228],
  mist: [160, 173, 184],
  dim: [110, 124, 136],
  gold: [250, 187, 65],
  coral: [247, 116, 93],
  kelp: [108, 215, 157],
  storm: [161, 122, 223],
} satisfies Record<string, Rgb>
/**
 * One color per squad member, recorder first. The validator puts the worst colorblind pair (pink and green) at ΔE 7.2,
 * which is only legal with labels, so tracked players always carry their name on the map.
 */
export const squadColors: Rgb[] = [rgb.gold, rgb.kelp, [90, 168, 255], [255, 122, 192]]
export const alpha = (color: Rgb, a: number): [number, number, number, number] => [...color, Math.round(a * 255)]
