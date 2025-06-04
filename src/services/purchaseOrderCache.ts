import {
  invalidateCache,
  clearCacheCategory,
  updateCache,
} from '../services/cacheService';
import prisma from '../helper/prisma';

/**
 * Purchase order cache management utility
 * This provides methods to manage purchase order data in the cache
 */
export const purchaseOrderCache = {
  /**
   * Invalidate a specific purchase order in the cache
   * @param purchaseOrderId The ID of the purchase order to invalidate
   */
  invalidate: (purchaseOrderId: number): void => {
    invalidateCache('purchaseOrder', purchaseOrderId);
  },

  /**
   * Clear all purchase orders from the cache
   */
  clearAll: (): void => {
    clearCacheCategory('purchaseOrder');
  },

  /**
   * Update a purchase order in the cache after database update
   * @param purchaseOrderId The ID of the purchase order to update
   * @param newData The updated data (optional - will fetch from DB if not provided)
   */
  update: async (purchaseOrderId: number, newData?: any): Promise<void> => {
    if (newData) {
      updateCache('purchaseOrder', purchaseOrderId, newData);
      return;
    }

    // If no data provided, fetch fresh data from database
    const freshData = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        robotInventory: true,
        antenna: true,
        plugin: true,
        shelter: true,
      },
    });

    if (freshData) {
      updateCache('purchaseOrder', purchaseOrderId, freshData);
    } else {
      // If no data found, just invalidate the cache entry
      invalidateCache('purchaseOrder', purchaseOrderId);
    }
  },
};

export default purchaseOrderCache;
