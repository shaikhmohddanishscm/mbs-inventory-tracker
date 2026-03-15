import { type ReactNode, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({ title, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isDesktop, setIsDesktop] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(e.matches)
      if (e.matches) setIsOpen(true)
    }
    update(mq)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const showToggle = !isDesktop

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
      {/* Header — clickable only on mobile */}
      <button
        type="button"
        onClick={() => { if (showToggle) setIsOpen((prev) => !prev) }}
        className={`flex w-full items-center justify-between px-4 py-3 text-left ${showToggle ? 'cursor-pointer' : 'cursor-default'}`}
        aria-expanded={isOpen}
        aria-controls="collapsible-content"
        disabled={!showToggle}
      >
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
        {showToggle && (
          <ChevronDown
            className={`size-4 shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
          />
        )}
      </button>

      {/* Collapsible content */}
      <div
        id="collapsible-content"
        ref={contentRef}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}
