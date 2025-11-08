export function countLines(str: string) {
  let count = 1;
  for (const c of str) {
    if (c === '\n') count++;
  }
  return count;
}
