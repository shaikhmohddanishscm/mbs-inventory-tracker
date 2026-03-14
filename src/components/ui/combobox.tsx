import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function Combobox({ options, value, onValueChange, placeholder = 'Search...', className, disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    if (selectedOption) {
      setSearch(selectedOption.label)
    } else {
      setSearch('')
    }
  }, [selectedOption])

  const filtered = options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        if (selectedOption) {
          setSearch(selectedOption.label)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedOption])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="text"
        value={search}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
          if (!e.target.value) {
            onValueChange('')
          }
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 max-h-48 overflow-auto">
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                'flex w-full items-center px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-left',
                opt.value === value && 'bg-slate-100 dark:bg-slate-800 font-medium',
              )}
              onClick={() => {
                onValueChange(opt.value)
                setSearch(opt.label)
                setOpen(false)
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && search && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 p-3 text-sm text-slate-500">
          No materials found
        </div>
      )}
    </div>
  )
}
