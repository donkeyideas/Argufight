/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/[\s_-]+/g, '-')  // Replace spaces with hyphens
    .replace(/^-+|-+$/g, '')   // Remove leading/trailing hyphens
    .substring(0, 100) // Limit length
}

/**
 * Generate a unique slug with short ID suffix
 * Format: topic-slug-xyz123
 */
export function generateUniqueSlug(topic: string, shortId?: string): string {
  const baseSlug = generateSlug(topic)
  const id = shortId || Math.random().toString(36).substring(2, 8)
  return `${baseSlug}-${id}`
}
