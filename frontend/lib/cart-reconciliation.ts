import type { CartLine } from './customer-api'

export async function reconcileCart<T extends { availableQuantity: number; restaurant: { restaurantId: number } }>(
  lines: CartLine[], loadListing: (id: number) => Promise<T>,
) {
  const results = await Promise.all(lines.map(async line => {
    try {
      return { ...line, listing: await loadListing(line.surplusListingId) }
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && (error.status === 404 || error.status === 410)) return null
      throw error
    }
  }))
  const rows = results.filter(row => row !== null)
  const restaurantId = rows[0]?.listing.restaurant.restaurantId
  const items = rows.filter(row => row.listing.restaurant.restaurantId === restaurantId)
    .map(row => ({ ...row, quantity: Math.min(row.quantity, row.listing.availableQuantity) })).filter(row => row.quantity > 0)
  return { items, removedCount: lines.length - items.length }
}
