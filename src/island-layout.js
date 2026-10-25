// Keep terrain, bridges and walking routes on the same layout scale.
export const ISLAND_SCALE = 1.3;
export const WALK_RADIUS = 2.05 * ISLAND_SCALE;
export const NEIGHBOR_DISTANCE = 4.6 * ISLAND_SCALE;
export const ISLAND_POSITIONS = [[-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [-2, 1], [-1, 1], [0, 1], [-1, 2], [0, 2], [1, 1]]
  .map(([q, r]) => [(4.45 * q + 2.225 * r + 1.1) * ISLAND_SCALE, 0, (3.86 * r - 1.8) * ISLAND_SCALE]);
