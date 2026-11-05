'use client'

import Image from 'next/image'
import { useState } from 'react'
import { mediaUrl } from '../../lib/menu-api'

export default function FoodPhoto({ photoUrl, name, sizes }: { photoUrl?: string; name: string; sizes: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!photoUrl || failedUrl === photoUrl) return <span className="food-photo-placeholder" role="img" aria-label={`${name}: foto belum tersedia`}>Foto belum tersedia</span>
  return <Image src={mediaUrl(photoUrl)} alt={name} fill sizes={sizes} unoptimized onError={() => setFailedUrl(photoUrl)} />
}
