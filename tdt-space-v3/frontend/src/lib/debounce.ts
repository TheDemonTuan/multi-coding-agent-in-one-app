/**
 * Debounce utility function
 * Prevents rapid successive function calls
 */

type AnyFunction = (...args: any[]) => any;

// Debounced function type that includes cancel method
type DebouncedFunction<T extends AnyFunction> = T & { cancel(): void };

/**
 * Creates a debounced version of a function
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function with cancel method
 */
export function debounce<T extends AnyFunction>(fn: T, delay: number): DebouncedFunction<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as DebouncedFunction<T>;

  // Add cancel method
  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Creates a throttled version of a function
 * @param fn - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends AnyFunction>(fn: T, limit: number): T {
  let inThrottle = false;

  const throttled = ((...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  }) as T;

  return throttled;
}
