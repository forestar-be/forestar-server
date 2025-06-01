import { PurchaseOrder, RobotInventory } from '@prisma/client';
import { Request } from 'express';

export interface RequestClientPurchaseOrdersDevisSignature<
  P = { [key: string]: string },
  ResBody = any,
  ReqBody = any,
> extends Request<P, ResBody, ReqBody> {
  purchaseOrder: PurchaseOrder & {
    antenna: RobotInventory | null;
    plugin: RobotInventory | null;
    robotInventory: RobotInventory | null;
    shelter: RobotInventory | null;
  };
}
