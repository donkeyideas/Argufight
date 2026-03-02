/**
 * Utility function to format status strings by replacing underscores with spaces
 * and capitalizing appropriately
 */
export function formatStatus(status: string | null | undefined): string {
  if (!status) return 'PENDING'
  return status.replace(/_/g, ' ')
}

