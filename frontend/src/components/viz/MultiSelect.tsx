import { useEffect, useRef, useState } from 'react'

export interface MultiSelectOption {
  value: string
  label: string
}

/** 多选下拉：点击展开勾选列表，即时生效 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = '全部',
}: {
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${
          selected.length > 0 ? 'border-primary/50 text-primary' : 'border-line text-ink hover:border-primary/50'
        }`}
      >
        <span className="whitespace-nowrap">{label}</span>
        <span className={selected.length > 0 ? 'font-medium' : 'text-muted'}>
          {selected.length > 0 ? `已选 ${selected.length}` : placeholder}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          {options.length === 0 ? (
            <p className="px-2.5 py-2 text-sm text-muted">没有可选项</p>
          ) : (
            options.map((option) => {
              const checked = selected.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-bg"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? 'border-primary bg-primary text-white' : 'border-line bg-surface'
                    }`}
                    aria-hidden="true"
                  >
                    {checked && (
                      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                        <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${checked ? 'text-ink' : 'text-muted'}`}>{option.label}</span>
                </button>
              )
            })
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-lg border-t border-line px-2.5 py-1.5 text-left text-sm text-danger hover:bg-bg"
            >
              清空
            </button>
          )}
        </div>
      )}
    </div>
  )
}
