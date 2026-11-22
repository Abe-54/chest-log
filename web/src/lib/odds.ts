/** Epic's published Pirate Shop Access drop rate: one token in this many chests. */
export const CHESTS_PER_TOKEN = 137_500

/** The chance at least one of this many chests dropped a token, each chest an independent roll. */
export const tokenChance = (chests: number) => 1 - (1 - 1 / CHESTS_PER_TOKEN) ** chests

export const percent = (share: number) => `${(share * 100).toFixed(2)}%`
