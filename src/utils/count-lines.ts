export function countLines(str: string) {
  if (typeof str !== 'string' || str.length === 0) return 0;

  let count = 1;
  for (const c of str) {
    if (c === '\n') count++;
  }
  return count;
}
