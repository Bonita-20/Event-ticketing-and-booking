import { DomainError } from './errors.js';

/**
 * Merges two already-sorted arrays into a single sorted array while preserving
 * relative order of equal elements (stability).
 */
function merge(left, right, compare) {
  const merged = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    // Using <= ensures that if left[i] and right[j] are equal,
    // left[i] (which appeared earlier) is chosen first -> STABLE.
    if (compare(left[i], right[j]) <= 0) {
      merged.push(left[i]);
      i += 1;
    } else {
      merged.push(right[j]);
      j += 1;
    }
  }

  while (i < left.length) {
    merged.push(left[i]);
    i += 1;
  }

  while (j < right.length) {
    merged.push(right[j]);
    j += 1;
  }

  return merged;
}

/**
 * Stable O(n log n) merge sort.
 * Returns a brand-new sorted array without mutating the input array.
 *
 * @template T
 * @param {readonly T[]} items
 * @param {(a: T, b: T) => number} compare
 * @returns {T[]}
 */
export function mergeSort(items, compare) {
  if (!Array.isArray(items)) {
    throw new DomainError('VALIDATION', 'items must be an array.');
  }
  if (typeof compare !== 'function') {
    throw new DomainError('VALIDATION', 'compare must be a function.');
  }

  // Base case: return a shallow copy so the original array is never shared/mutated
  if (items.length <= 1) {
    return [...items];
  }

  const mid = Math.floor(items.length / 2);
  const left = mergeSort(items.slice(0, mid), compare);
  const right = mergeSort(items.slice(mid), compare);

  return merge(left, right, compare);
}