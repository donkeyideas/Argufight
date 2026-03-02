/**
 * Centralized error handling utilities
 */

export interface ApiError {
  error: string
  details?: string
  code?: string
}

export function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  if (typeof error === 'object' && error !== null && 'error' in error) {
    return (error as ApiError).error || 'An unexpected error occurred'
  }
  
  return 'An unexpected error occurred'
}

export function getErrorDetails(error: unknown): ApiError {
  if (error instanceof Error) {
    return {
      error: error.message,
      details: error.stack,
    }
  }
  
  if (typeof error === 'object' && error !== null && 'error' in error) {
    return error as ApiError
  }
  
  return {
    error: 'An unexpected error occurred',
  }
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch')
    )
  }
  return false
}

export function isAuthError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string }).code
    return code === 'UNAUTHORIZED' || code === 'FORBIDDEN'
  }
  return false
}










