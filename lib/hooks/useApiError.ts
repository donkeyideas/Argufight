import { useToast } from '@/components/ui/toast';
import { formatApiError, isNetworkError, isAuthError } from '@/lib/utils/error-handler';

interface UseApiErrorOptions {
  showToast?: boolean;
  defaultMessage?: string;
}

export function useApiError(options: UseApiErrorOptions = {}) {
  const { error: toastError } = useToast();
  const { showToast: showToastOption = true, defaultMessage = 'An error occurred' } = options;

  const handleError = (error: unknown, customMessage?: string) => {
    const errorMessage = customMessage ?? formatApiError(error) ?? defaultMessage;

    console.error('API Error:', error);

    if (showToastOption) {
      if (isNetworkError(error)) {
        toastError('Network error', 'Please check your internet connection and try again.');
      } else if (isAuthError(error)) {
        toastError('Session expired', 'Please sign in again to continue.');
      } else {
        toastError('Error', errorMessage);
      }
    }

    return errorMessage;
  };

  return { handleError };
}
