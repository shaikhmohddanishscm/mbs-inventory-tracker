export type Unit = 'Piece' | 'Bottle'

export type MaterialType = 'Core' | 'Packaging'

export interface RawMaterial {
  id: string
  name: string
  measuredUnit: Unit
  type: MaterialType
  dateAdded: string
  dateModified: string
}

export interface RawBuyingItem {
  rawMaterialId: string
  quantity: number
  unit: Unit
}

export interface Product {
  id: string
  name: string
  measuredUnit: Unit
  dateAdded: string
  dateModified: string
}

export interface FormulaItem {
  productId: string
  rawMaterialId: string
  quantityRequired: number
  unit: Unit
  type: MaterialType
}

export interface FinishedInventoryBatch {
  id: string
  productId: string
  batchNo: string
  quantity: number
  unit: Unit
  lastUpdatedAt: string
}

export interface SalesItem {
  productId: string
  quantity: number
  unit: Unit
  soldAt: string
}

export type MovementType = 'RAW_BUYING' | 'PRODUCTION' | 'SALES' | 'ADJUSTMENT'

export interface InventoryMovement {
  id: string
  movementType: MovementType
  itemName: string
  quantity: number
  unit: Unit
  occurredAt: string
}
