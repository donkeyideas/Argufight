export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export async function fetchClient<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new ApiError('Unauthorized', 401)
    }

    let errorData: unknown
    try {
      errorData = await res.json()
    } catch {
      errorData = { message: res.statusText }
    }

    const message =
      (errorData as { error?: string })?.error ||
      (errorData as { message?: string })?.message ||
      `Request failed with status ${res.status}`

    throw new ApiError(message, res.status, errorData)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json()
}
