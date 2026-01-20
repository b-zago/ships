export async function safeRedisOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string,
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    return null;
  }
}

export async function strictRedisOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    throw new Error(errorMessage);
  }
}
