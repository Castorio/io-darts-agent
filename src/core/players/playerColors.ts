/**
 * Player colors for match events. Known players keep the color of their
 * profile; everyone else gets a default color picked by the stable
 * player.index (Autodarts rotates the players array after every leg) and
 * never one a known player in the same match already uses.
 */

export const DEFAULT_PLAYER_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

export interface ColorablePlayer {
  name?: string;
  index?: number;
  color?: string;
}

export type ProfileLookup = (name: string) => Promise<{ color?: string } | null | undefined>;

/** Returns one color per player, in the order of `players` */
export async function assignPlayerColors(
  players: ColorablePlayer[],
  lookup: ProfileLookup,
  defaults: string[] = DEFAULT_PLAYER_COLORS,
): Promise<string[]> {
  const fixed = await Promise.all(players.map(async (player) => {
    if (typeof player.color === 'string' && player.color) return player.color;
    if (!player.name) return null;
    try {
      const color = (await lookup(player.name))?.color;
      return typeof color === 'string' && color ? color : null;
    } catch {
      return null;
    }
  }));

  const used = new Set(fixed.filter((c): c is string => !!c).map((c) => c.toLowerCase()));
  const colors = [...fixed];
  // Unassigned players in stable index order, so the result does not depend on the rotation
  const open = players
    .map((player, position) => ({ position, index: player.index ?? position }))
    .filter(({ position }) => !fixed[position])
    .sort((a, b) => a.index - b.index);
  for (const { position, index } of open) {
    let color = defaults[index % defaults.length];
    for (let step = 0; step < defaults.length && used.has(color.toLowerCase()); step++) {
      color = defaults[(index + step + 1) % defaults.length];
    }
    used.add(color.toLowerCase());
    colors[position] = color;
  }
  return colors as string[];
}
