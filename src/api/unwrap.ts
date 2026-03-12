// Backend wraps all responses in { success, statusCode, message, data: T }
// Axios gives us response.data = { success, statusCode, data: T }
// This helper extracts the actual payload

export function unwrapData<T>(raw: unknown): T {
  const obj = raw as Record<string, unknown>;
  if (obj && typeof obj === 'object' && obj.success !== undefined && obj.data !== undefined) {
    return obj.data as T;
  }
  return raw as T;
}
