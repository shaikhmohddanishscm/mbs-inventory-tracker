/**
 * Maps raw database / RPC error messages to user-friendly strings.
 * Falls back to a generic message for unrecognized errors.
 */

const ERROR_MAP: Array<{ pattern: RegExp; message: string | ((match: RegExpMatchArray) => string) }> = [
  // Foreign key violations
  {
    pattern: /violates foreign key constraint "finished_inventory_batches_product_id_fkey"/i,
    message: 'This product has production batches. Delete the batches first before removing the product.',
  },
  {
    pattern: /violates foreign key constraint "sales_items_product_id_fkey"/i,
    message: 'This product has sales records. Remove associated sales before deleting.',
  },
  {
    pattern: /violates foreign key constraint "product_formula_items_product_id_fkey"/i,
    message: 'This product has formula items. Remove the formula before deleting.',
  },
  {
    pattern: /violates foreign key constraint "product_formula_items_raw_material_id_fkey"/i,
    message: 'This raw material is used in a product formula. Remove it from the formula first.',
  },
  {
    pattern: /violates foreign key constraint "raw_material_details_raw_material_id_fkey"/i,
    message: 'This raw material has stock entries. Delete the detail entries first.',
  },
  {
    pattern: /violates foreign key constraint "sales_items_sale_id_fkey"/i,
    message: 'This sale has line items. Remove the items before deleting the sale.',
  },
  {
    pattern: /violates foreign key constraint/i,
    message: 'Cannot delete — this item is referenced elsewhere. Remove related records first.',
  },

  // Unique violations
  {
    pattern: /violates unique constraint.*raw_materials_name_key/i,
    message: 'A raw material with this name already exists.',
  },
  {
    pattern: /violates unique constraint.*products_name_key/i,
    message: 'A product with this name already exists.',
  },
  {
    pattern: /violates unique constraint/i,
    message: 'A record with this value already exists. Please use a unique value.',
  },

  // Check constraint violations
  {
    pattern: /violates check constraint.*quantity/i,
    message: 'Quantity must be a valid positive number.',
  },

  // RPC / business-logic errors (these come from RAISE EXCEPTION in our functions)
  {
    pattern: /insufficient stock for (.+?) \(needed (.+?), available (.+?)\)/i,
    message: (match: RegExpMatchArray) =>
      `Not enough ${match[1]} — need ${match[2]} but only ${match[3]} available.`,
  },
  {
    pattern: /insufficient stock/i,
    message: 'Not enough raw material stock available for this operation.',
  },
  {
    pattern: /stock would go negative/i,
    message: 'Cannot complete — this would result in negative stock.',
  },
  {
    pattern: /no formula items defined/i,
    message: 'This product has no formula defined. Add formula items in Combimaker first.',
  },

  // Network / auth
  {
    pattern: /fetch|network|ERR_/i,
    message: 'Network error. Please check your connection and try again.',
  },
  {
    pattern: /JWT|token|unauthorized|403/i,
    message: 'Your session has expired. Please log in again.',
  },
]

export function friendlyError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Something went wrong.'

  for (const entry of ERROR_MAP) {
    const match = raw.match(entry.pattern)
    if (match) {
      return typeof entry.message === 'function' ? entry.message(match) : entry.message
    }
  }

  // Fallback: if it looks like a Postgres error, show generic message
  if (/violates|constraint|relation|column|pg_/i.test(raw)) {
    return 'An unexpected database error occurred. Please try again or contact support.'
  }

  return raw
}
