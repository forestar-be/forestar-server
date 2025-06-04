import logger from '../config/logger';

// Cache structure with TTL functionality
interface CacheItem {
  data: any;
  expiry: number;
}

interface CacheMap {
  [key: string]: CacheItem;
}

// Cache categories for different types of data
type CacheCategory = 'purchaseOrder' | 'client' | 'robot' | string;

// In-memory cache store organized by categories
const cacheStore: Record<CacheCategory, CacheMap> = {
  purchaseOrder: {},
  client: {},
  robot: {},
};

// Cache TTL in milliseconds (5 minutes by default)
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Get an item from cache or fetch it using the provided function
 * @param category The category of item (e.g., 'purchaseOrder')
 * @param key The item's unique identifier within its category
 * @param fetchFn Function to fetch the data if not in cache
 * @param ttl Time-to-live in milliseconds (defaults to 5 minutes)
 */
export async function getOrFetchFromCache<T>(
  category: CacheCategory,
  key: string | number,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_CACHE_TTL,
): Promise<T | null> {
  // Ensure the category exists
  if (!cacheStore[category]) {
    cacheStore[category] = {};
  }

  const cacheKey = `${category}_${key}`;
  const now = Date.now();
  const cache = cacheStore[category];

  // Check if the item is in cache and not expired
  if (cache[cacheKey] && cache[cacheKey].expiry > now) {
    logger.debug(`Cache hit for ${category} with key ${key}`);
    return cache[cacheKey].data as T;
  }

  // If not in cache or expired, fetch using provided function
  logger.debug(
    `Cache miss for ${category} with key ${key}, fetching fresh data`,
  );
  const data = await fetchFn();

  // Store in cache if data is found
  if (data) {
    cache[cacheKey] = {
      data,
      expiry: now + ttl,
    };
  }

  return data;
}

/**
 * Manually invalidate a specific item in the cache
 * @param category The category of the item to invalidate
 * @param key The key of the item to invalidate
 */
export function invalidateCache(
  category: CacheCategory,
  key: string | number,
): boolean {
  if (!cacheStore[category]) {
    return false;
  }

  const cacheKey = `${category}_${key}`;
  if (cacheStore[category][cacheKey]) {
    delete cacheStore[category][cacheKey];
    logger.debug(`Cache invalidated for ${category} with key ${key}`);
    return true;
  }

  return false;
}

/**
 * Clear an entire category from the cache
 * @param category The category to clear
 */
export function clearCacheCategory(category: CacheCategory): boolean {
  if (!cacheStore[category]) {
    return false;
  }

  cacheStore[category] = {};
  logger.debug(`Cache cleared for category ${category}`);
  return true;
}

/**
 * Clear the entire cache across all categories
 */
export function clearAllCache(): void {
  Object.keys(cacheStore).forEach((category) => {
    cacheStore[category as CacheCategory] = {};
  });
  logger.debug('All cache cleared');
}

/**
 * Update an item in the cache with new data
 * @param category The category of the item to update
 * @param key The key of the item to update
 * @param data The new data to store
 * @param ttl Time-to-live in milliseconds (defaults to 5 minutes)
 */
export function updateCache<T>(
  category: CacheCategory,
  key: string | number,
  data: T,
  ttl: number = DEFAULT_CACHE_TTL,
): void {
  if (!cacheStore[category]) {
    cacheStore[category] = {};
  }

  const cacheKey = `${category}_${key}`;
  cacheStore[category][cacheKey] = {
    data,
    expiry: Date.now() + ttl,
  };
  logger.debug(`Cache updated for ${category} with key ${key}`);
}
