/** Splits `items` into consecutive chunks of at most `size` elements. */
export function chunk<TItem>(items: readonly TItem[], size: number): TItem[][] {
  if (size < 1) {
    throw new Error('Chunk size must be at least 1');
  }

  const chunks: TItem[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
