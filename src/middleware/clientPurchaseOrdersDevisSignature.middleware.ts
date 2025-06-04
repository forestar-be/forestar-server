import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import logger from '../config/logger';
import prisma from '../helper/prisma';
import { RequestClientPurchaseOrdersDevisSignature } from '../types/clientPurchaseOrdersDevisSignature.types';
import { getOrFetchFromCache } from '../services/cacheService';

export async function clientPurchaseOrdersDevisSignatureMiddleware(
  req: RequestClientPurchaseOrdersDevisSignature,
  res: Response,
  next: NextFunction,
) {
  const { id } = req.query;

  // check if id is provided and is a valid number
  if (!id || isNaN(Number(id))) {
    return res
      .status(400)
      .json({ message: 'Invalid or missing purchase order ID' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token is required' });
  }

  try {
    // Find the purchase order by ID using cache
    const purchaseOrder = await getOrFetchFromCache(
      'purchaseOrder',
      parseInt(id as string),
      async () => {
        return prisma.purchaseOrder.findUnique({
          where: { id: parseInt(id as string) },
          include: {
            robotInventory: true,
            antenna: true,
            plugin: true,
            shelter: true,
          },
        });
      },
    );

    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    // Verify the token
    if (
      !purchaseOrder.devisSignatureAccessTokenArray ||
      !purchaseOrder.devisSignatureAccessTokenArray.length
    ) {
      return res
        .status(401)
        .json({ message: 'Purchase order has no access token configured' });
    }

    // Compare the provided token against any of the stored hashes in the array, from last to first, stopping as soon as possible
    let isValid = false;
    for (
      let i = purchaseOrder.devisSignatureAccessTokenArray.length - 1;
      i >= 0;
      i--
    ) {
      if (
        await bcrypt.compare(
          token.toString(),
          purchaseOrder.devisSignatureAccessTokenArray[i],
        )
      ) {
        isValid = true;
        break;
      }
    }

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid access token' });
    }

    // Attach purchase order to request for later use
    req.purchaseOrder = purchaseOrder;
    next();
  } catch (error) {
    logger.error(`Error verifying signature token: ${error}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export default clientPurchaseOrdersDevisSignatureMiddleware;
