// Create one pool per request. A shared module-level queue would mix Worker
// request lifetimes and could start I/O on behalf of another visitor.
export function requestPool(limit: number) {
  if (!Number.isInteger(limit) || limit < 1)
    throw new RangeError("The request pool needs a positive integer limit.");
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit)
      await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      // Hand the occupied slot directly to the next caller, even after failure.
      if (next) next();
      else active--;
    }
  };
}
