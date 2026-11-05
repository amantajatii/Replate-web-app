import { apiUrl } from './api'

export type Restaurant = { restaurantId: number; name: string }
export type Menu = {
  menuId: number
  restaurantId: number
  name: string
  description: string
  category: string
  normalPrice: number
  allergens: string[]
  dietTags: string[]
  allergenNote: string | null
  isActive: boolean
  photos: string[]
}
export type MenuInput = Omit<Menu, 'menuId' | 'restaurantId'>
export type Production = {
  productionRecordId: number
  menuId: number
  productionDate: string
  producedQuantity: number
  soldQuantity: number
  surplusQuantity: number
}

export function ownerToken(): string | null {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      const session = JSON.parse(storage.getItem('replate-session') ?? 'null')
      if (
        session?.role === 'RestaurantOwner' &&
        session?.token &&
        Date.parse(session.expiresAt) > Date.now()
      )
        return session.token as string
    } catch {
      /* invalid local session */
    }
  }
  return null
}

export async function ownerRequest<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...options?.headers },
    })
  } catch {
    throw new Error('Tidak dapat terhubung ke server.')
  }
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as {
      title?: string
    } | null
    throw Object.assign(new Error(detail?.title ?? `Permintaan gagal (${response.status}).`), { status: response.status })
  }
  return response.json() as Promise<T>
}

export function mediaUrl(path: string) {
  return `${apiUrl}${path}`
}
