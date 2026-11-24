import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a date filter string into epoch milliseconds.
 * If `isUpperBound` is true and input is date-only ("YYYY-MM-DD"),
 * expands to the very end of that UTC day (23:59:59.999Z).
 */
function parseDateBoundary(value, fieldName, isUpperBound = false) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError('VALIDATION', `${fieldName} must be a valid date string.`);
  }

  const trimmed = value.trim();
  const normalized =
    isUpperBound && DATE_ONLY_REGEX.test(trimmed)
      ? `${trimmed}T23:59:59.999Z`
      : trimmed;

  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) {
    throw new DomainError('VALIDATION', `${fieldName} is not a valid date: ${value}`);
  }

  return ms;
}

/**
 * Pure filter over event summaries. Returns a new array without mutating inputs.
 */
export function filterEvents(summaries, criteria = {}) {
  if (!Array.isArray(summaries)) {
    throw new DomainError('VALIDATION', 'summaries must be an array.');
  }

  const {
    q,
    city,
    from,
    to,
    maxPriceCents,
    onlyAvailable = false,
  } = criteria ?? {};

  const queryTerm =
    typeof q === 'string' && q.trim().length > 0 ? q.trim().toLowerCase() : null;

  const cityTerm =
    typeof city === 'string' && city.trim().length > 0
      ? city.trim().toLowerCase()
      : null;

  const fromMs = from !== undefined && from !== null ? parseDateBoundary(from, 'from', false) : null;
  const toMs = to !== undefined && to !== null ? parseDateBoundary(to, 'to', true) : null;

  if (maxPriceCents !== undefined && maxPriceCents !== null) {
    if (!Number.isInteger(maxPriceCents) || maxPriceCents < 0) {
      throw new DomainError(
        'VALIDATION',
        'maxPriceCents must be a non-negative integer.'
      );
    }
  }

  return summaries.filter((event) => {
    // 1. Text search on title or venue (case-insensitive substring)
    if (queryTerm !== null) {
      const titleMatch = event.title.toLowerCase().includes(queryTerm);
      const venueMatch = event.venue.toLowerCase().includes(queryTerm);
      if (!titleMatch && !venueMatch) return false;
    }

    // 2. City filter (case-insensitive exact match)
    if (cityTerm !== null) {
      if (event.city.toLowerCase() !== cityTerm) return false;
    }

    // 3. Inclusive date range filter
    if (fromMs !== null || toMs !== null) {
      const eventMs = Date.parse(event.date);
      if (fromMs !== null && eventMs < fromMs) return false;
      if (toMs !== null && eventMs > toMs) return false;
    }

    // 4. Maximum price filter (events with no tiers are excluded)
    if (maxPriceCents !== undefined && maxPriceCents !== null) {
      if (event.minPriceCents === null || event.minPriceCents > maxPriceCents) {
        return false;
      }
    }

    // 5. Availability filter
    if (onlyAvailable && event.availableSeats <= 0) {
      return false;
    }

    return true;
  });
}

function compareTieBreakers(a, b) {
  const titleCmp = a.title.localeCompare(b.title);
  if (titleCmp !== 0) return titleCmp;
  return a.id.localeCompare(b.id);
}

/**
 * Pure sort over event summaries using custom stable mergeSort.
 * Supported sortBy: 'date' | 'price' | 'availability'.
 */
export function sortEvents(summaries, sortBy = 'date') {
  if (!Array.isArray(summaries)) {
    throw new DomainError('VALIDATION', 'summaries must be an array.');
  }

  if (sortBy !== 'date' && sortBy !== 'price' && sortBy !== 'availability') {
    throw new DomainError(
      'VALIDATION',
      `Unknown sort option "${sortBy}". Expected "date", "price", or "availability".`
    );
  }

  const compare = (a, b) => {
    if (sortBy === 'date') {
      const timeDiff = Date.parse(a.date) - Date.parse(b.date);
      if (timeDiff !== 0) return timeDiff;
      return compareTieBreakers(a, b);
    }

    if (sortBy === 'price') {
      // Events with no price (null) always sort last
      if (a.minPriceCents === null && b.minPriceCents === null) {
        return compareTieBreakers(a, b);
      }
      if (a.minPriceCents === null) return 1;
      if (b.minPriceCents === null) return -1;

      const priceDiff = a.minPriceCents - b.minPriceCents;
      if (priceDiff !== 0) return priceDiff;
      return compareTieBreakers(a, b);
    }

    // sortBy === 'availability' (most seats left first)
    const availDiff = b.availableSeats - a.availableSeats;
    if (availDiff !== 0) return availDiff;
    return compareTieBreakers(a, b);
  };

  return mergeSort(summaries, compare);
}

/**
 * Filters event summaries, then sorts the matching results.
 */
export function searchEvents(summaries, criteria = {}, sortBy = 'date') {
  const filtered = filterEvents(summaries, criteria);
  return sortEvents(filtered, sortBy);
}