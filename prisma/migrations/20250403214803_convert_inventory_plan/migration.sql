-- Migration: Convert InventoryPlan from monthly to yearly tracking

-- Step 1: Create a backup of the original table just in case
CREATE TABLE "InventoryPlan_backup" AS SELECT * FROM "InventoryPlan";

-- Step 2: Create a temporary table to hold yearly aggregated inventory data
CREATE TEMPORARY TABLE temp_yearly_inventory (
  robot_inventory_id INT,
  year INT,
  quantity INT,
  PRIMARY KEY (robot_inventory_id, year)
);

-- Step 3: Aggregate monthly data into yearly data by summing quantities
INSERT INTO temp_yearly_inventory (robot_inventory_id, year, quantity)
SELECT 
  "robotInventoryId", 
  year, 
  SUM(quantity) AS total_quantity
FROM "InventoryPlan"
GROUP BY "robotInventoryId", year;

-- Step 4: Delete all existing records from InventoryPlan
DELETE FROM "InventoryPlan";

-- Step 5: Drop the unique constraint that includes month
ALTER TABLE "InventoryPlan" DROP CONSTRAINT IF EXISTS "InventoryPlan_robotInventoryId_year_month_key";

-- Step 6: Add a new unique constraint for robotInventoryId and year
ALTER TABLE "InventoryPlan" ADD CONSTRAINT "InventoryPlan_robotInventoryId_year_key" UNIQUE ("robotInventoryId", year);

-- Step 7: Alter table to drop month column
ALTER TABLE "InventoryPlan" ALTER COLUMN month DROP NOT NULL;
ALTER TABLE "InventoryPlan" DROP COLUMN month;

-- Step 8: Reset the ID sequence to avoid potential conflicts
ALTER SEQUENCE "InventoryPlan_id_seq" RESTART WITH 1;

-- Step 9: Insert aggregated yearly data back into InventoryPlan
INSERT INTO "InventoryPlan" (
  "robotInventoryId", 
  year,
  quantity,
  "createdAt",
  "updatedAt"
)
SELECT 
  robot_inventory_id, 
  year, 
  quantity,
  NOW(),
  NOW()
FROM temp_yearly_inventory;

-- Step 10: Drop the temporary table
DROP TABLE temp_yearly_inventory;