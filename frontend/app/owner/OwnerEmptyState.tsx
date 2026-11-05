import type { ReactNode } from 'react'

export default function OwnerEmptyState({ title, children, action, className = '' }: {
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return <section className={`owner-empty-state ${className}`}>
    <h2>{title}</h2>
    {children && <p>{children}</p>}
    {action && <div className="owner-empty-action">{action}</div>}
  </section>
}
