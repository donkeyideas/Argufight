/**
 * Format ad placement strings for display
 * Converts PROFILE_BANNER -> Profile Banner
 */
export function formatPlacement(placement: string): string {
  return placement
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
