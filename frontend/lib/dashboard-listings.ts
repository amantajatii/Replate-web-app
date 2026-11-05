import type { SurplusListing } from './listing-api'

export function availableListings(listings: SurplusListing[], now: number) {
  return listings.filter(item => item.status === 'Active' && item.availableQuantity > 0 && Date.parse(item.pickupEnd) > now)
}
