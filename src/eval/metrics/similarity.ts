import { distance } from 'fastest-levenshtein';
import type { SimilarityResult } from '../types.js';
import { stripInvisibleChars, normalizeWhitespace } from '../adapters/adapter.js';
import crypto from 'node:crypto';

export function editDistance(genStr: string, standardStr: string): number {
  const gen = stripInvisibleChars(genStr);
  const std = stripInvisibleChars(standardStr);
  
  if (gen.length === 0 || std.length === 0) return 0.0;
  
  const dist = distance(gen, std);
  return 1.0 - (dist / Math.max(gen.length, std.length));
}

function hashFun(text: string): number {
  const hash = crypto.createHash('sha1').update(text, 'utf8').digest('hex');
  return parseInt(hash.slice(-4), 16);
}

function kgrams(text: string, n: number): string[] {
  const result: string[] = [];
  for (let i = 0; i <= text.length - n; i++) {
    result.push(text.slice(i, i + n));
  }
  return result;
}

function doHashing(kgramList: string[]): { hash: number, index: number }[] {
  return kgramList.map((kg, i) => ({ hash: hashFun(kg), index: i }));
}

function slWindow(hashes: { hash: number, index: number }[], n: number): { hash: number, index: number }[][] {
  const result: { hash: number, index: number }[][] = [];
  for (let i = 0; i <= hashes.length - n; i++) {
    result.push(hashes.slice(i, i + n));
  }
  return result;
}

function getMin(windows: { hash: number, index: number }[][]): { hash: number, index: number }[] {
  const result: { hash: number, index: number }[] = [];
  let prevMin: { hash: number, index: number } | null = null;
  
  for (const w of windows) {
    const first = w[0];
    if (!first) continue;

    let minH = first;
    for (const h of w) {
      if (h.hash < minH.hash || (h.hash === minH.hash && h.index > minH.index)) {
        minH = h;
      }
    }
    
    if (!prevMin || minH.hash !== prevMin.hash || minH.index !== prevMin.index) {
      result.push(minH);
    }
    prevMin = minH;
  }
  return result;
}

export function winnowing(genStr: string, standardStr: string): number {
  const gen = stripInvisibleChars(genStr);
  const std = stripInvisibleChars(standardStr);
  
  if (gen.length === 0 && std.length === 0) return 0.0;
  if (gen.length === 0 || std.length === 0) return 0.0; 
  
  // Small code-conflict snippets need a short fingerprint. k=5 captures local
  // token/identifier structure, while window=4 smooths tiny formatting edits
  // without making unrelated snippets look similar.
  const kSize = 5;
  const winSize = 4;
  
  const winnow = (text: string) => {
    if (text.length < kSize) return new Set<number>();
    const hashes = doHashing(kgrams(text, kSize));
    if (hashes.length < winSize) return new Set<number>(hashes.map(h => h.hash));
    const mins = getMin(slWindow(hashes, winSize));
    return new Set(mins.map(m => m.hash));
  };
  
  const w1 = winnow(gen);
  const w2 = winnow(std);
  
  const hashA = Array.from(w1);
  const hashB = Array.from(w2);
  
  const intersect = hashA.filter(v => w2.has(v)).length + hashB.filter(v => w1.has(v)).length;
  const union = hashA.length + hashB.length;
  
  if (union === 0) return 0.0;
  return intersect / union;
}

export function exactMatch(genStr: string, standardStr: string): boolean {
  return normalizeWhitespace(genStr) === normalizeWhitespace(standardStr);
}

export function lineDiffOverlap(genStr: string, standardStr: string): number {
  const genLines = genStr.split('\n').map(s => s.trim()).filter(Boolean);
  const stdLines = standardStr.split('\n').map(s => s.trim()).filter(Boolean);
  
  let matches = 0;
  for (const gl of genLines) {
    if (stdLines.includes(gl)) matches++;
  }
  
  const maxLines = Math.max(genLines.length, stdLines.length);
  if (maxLines === 0) return 1.0;
  return matches / maxLines;
}

export function evaluateSimilarity(genStr: string, standardStr: string): SimilarityResult {
  const ed = editDistance(genStr, standardStr);
  const win = winnowing(genStr, standardStr);
  const em = exactMatch(genStr, standardStr);
  const ld = lineDiffOverlap(genStr, standardStr);
  
  // Edit distance is the strongest reference-similarity signal for snippet
  // datasets. Winnowing catches reordered/localized overlap, and line overlap
  // gives a simpler readable-code signal without dominating exact text quality.
  const SCORE_WEIGHT_EDIT_DISTANCE = 0.5;
  const SCORE_WEIGHT_WINNOWING = 0.3;
  const SCORE_WEIGHT_LINE_DIFF = 0.2;
  
  const score = em ? 1.0 : (SCORE_WEIGHT_EDIT_DISTANCE * ed + SCORE_WEIGHT_WINNOWING * win + SCORE_WEIGHT_LINE_DIFF * ld);
  
  return {
    editDistance: ed,
    winnowing: win,
    exactMatch: em,
    lineDiff: ld,
    score
  };
}
