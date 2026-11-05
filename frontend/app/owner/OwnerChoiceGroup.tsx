'use client'

import { nextChoiceIndex } from '../../lib/choice-navigation'
import { useId } from 'react'

type Option<T extends string> = { value: T; label: string }

export default function OwnerChoiceGroup<T extends string>({
  label, options, value, onChange, className = '', tabs = false, idPrefix,
}: {
  label: string
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  tabs?: boolean
  idPrefix?: string
}) {
  const generatedId = useId()
  const prefix = idPrefix ?? generatedId
  return <div
    className={`owner-choice-group ${className}`}
    role={tabs ? 'tablist' : 'group'}
    aria-label={label}
    onKeyDown={tabs ? (event) => {
      const buttons = Array.from(event.currentTarget.querySelectorAll('button'))
      const next = nextChoiceIndex(event.key, buttons.indexOf(event.target as HTMLButtonElement), buttons.length)
      if (next === null) return
      event.preventDefault()
      buttons[next].focus()
      onChange(options[next].value)
    } : undefined}
  >
    {options.map((option) => <button
      key={option.value}
      type="button"
      role={tabs ? 'tab' : undefined}
      id={tabs ? `${prefix}-tab-${option.value}` : undefined}
      aria-controls={tabs ? `${prefix}-panel-${option.value}` : undefined}
      aria-selected={tabs ? value === option.value : undefined}
      aria-pressed={tabs ? undefined : value === option.value}
      tabIndex={tabs && value !== option.value ? -1 : 0}
      onClick={() => onChange(option.value)}
    >{option.label}</button>)}
  </div>
}
