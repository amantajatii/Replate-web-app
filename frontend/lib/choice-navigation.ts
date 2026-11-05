export function nextChoiceIndex(key: string, index: number, count: number): number | null {
  if (count < 1 || index < 0 || index >= count) return null
  switch (key) {
    case 'ArrowRight': return (index + 1) % count
    case 'ArrowLeft': return (index + count - 1) % count
    case 'Home': return 0
    case 'End': return count - 1
    default: return null
  }
}
