// First 151 Pokémon (Gen 1) for workspace naming
export const POKEMON_NAMES = [
  'bulbasaur', 'ivysaur', 'venusaur', 'charmander', 'charmeleon', 'charizard',
  'squirtle', 'wartortle', 'blastoise', 'caterpie', 'metapod', 'butterfree',
  'weedle', 'kakuna', 'beedrill', 'pidgey', 'pidgeotto', 'pidgeot',
  'rattata', 'raticate', 'spearow', 'fearow', 'ekans', 'arbok',
  'pikachu', 'raichu', 'sandshrew', 'sandslash', 'nidoran-f', 'nidorina',
  'nidoqueen', 'nidoran-m', 'nidorino', 'nidoking', 'clefairy', 'clefable',
  'vulpix', 'ninetales', 'jigglypuff', 'wigglytuff', 'zubat', 'golbat',
  'oddish', 'gloom', 'vileplume', 'paras', 'parasect', 'venonat',
  'venomoth', 'diglett', 'dugtrio', 'meowth', 'persian', 'psyduck',
  'golduck', 'mankey', 'primeape', 'growlithe', 'arcanine', 'poliwag',
  'poliwhirl', 'poliwrath', 'abra', 'kadabra', 'alakazam', 'machop',
  'machoke', 'machamp', 'bellsprout', 'weepinbell', 'victreebel', 'tentacool',
  'tentacruel', 'geodude', 'graveler', 'golem', 'ponyta', 'rapidash',
  'slowpoke', 'slowbro', 'magnemite', 'magneton', 'farfetchd', 'doduo',
  'dodrio', 'seel', 'dewgong', 'grimer', 'muk', 'shellder',
  'cloyster', 'gastly', 'haunter', 'gengar', 'onix', 'drowzee',
  'hypno', 'krabby', 'kingler', 'voltorb', 'electrode', 'exeggcute',
  'exeggutor', 'cubone', 'marowak', 'hitmonlee', 'hitmonchan', 'lickitung',
  'koffing', 'weezing', 'rhyhorn', 'rhydon', 'chansey', 'tangela',
  'kangaskhan', 'horsea', 'seadra', 'goldeen', 'seaking', 'staryu',
  'starmie', 'mr-mime', 'scyther', 'jynx', 'electabuzz', 'magmar',
  'pinsir', 'tauros', 'magikarp', 'gyarados', 'lapras', 'ditto',
  'eevee', 'vaporeon', 'jolteon', 'flareon', 'porygon', 'omanyte',
  'omastar', 'kabuto', 'kabutops', 'aerodactyl', 'snorlax', 'articuno',
  'zapdos', 'moltres', 'dratini', 'dragonair', 'dragonite', 'mewtwo', 'mew'
] as const

export type PokemonName = typeof POKEMON_NAMES[number]

/**
 * Generate a unique workspace name based on Pokémon names.
 *
 * Strategy:
 * 1. Try a random Pokémon name
 * 2. If taken, try adding version numbers (v2, v3, etc.)
 * 3. If still colliding after v9, combine two Pokémon names
 * 4. Combinatorial space: 151 + (151 * 9) + (151 * 151) = 151 + 1359 + 22801 = 24,311 unique names
 */
export function generateWorkspaceName(existingNames: string[]): string {
  const existingSet = new Set(existingNames.map(n => n.toLowerCase()))

  // Shuffle pokemon array for randomness
  const shuffled = [...POKEMON_NAMES].sort(() => Math.random() - 0.5)

  // Strategy 1: Try a single Pokémon name
  for (const pokemon of shuffled) {
    if (!existingSet.has(pokemon)) {
      return pokemon
    }
  }

  // Strategy 2: Try Pokémon name with version number
  for (const pokemon of shuffled) {
    for (let v = 2; v <= 9; v++) {
      const versioned = `${pokemon}-v${v}`
      if (!existingSet.has(versioned)) {
        return versioned
      }
    }
  }

  // Strategy 3: Combine two Pokémon names (e.g., "pikachu-charizard")
  const shuffled2 = [...POKEMON_NAMES].sort(() => Math.random() - 0.5)
  for (const first of shuffled) {
    for (const second of shuffled2) {
      if (first !== second) {
        const combined = `${first}-${second}`
        if (!existingSet.has(combined)) {
          return combined
        }
      }
    }
  }

  // Fallback: Should never reach here with 24k+ combinations
  // but just in case, add a random suffix
  const randomPokemon = POKEMON_NAMES[Math.floor(Math.random() * POKEMON_NAMES.length)]
  const randomSuffix = Math.random().toString(36).substring(2, 6)
  return `${randomPokemon}-${randomSuffix}`
}

/**
 * Extract workspace names from existing workspaces for collision detection.
 * This extracts the name portion from branch names like "workspace/pikachu"
 */
export function extractWorkspaceNamesFromBranches(branchNames: string[]): string[] {
  return branchNames
    .filter(b => b.startsWith('workspace/'))
    .map(b => b.replace('workspace/', ''))
}
