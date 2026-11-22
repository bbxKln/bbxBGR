/** 品牌标记：蓝色圆角方块上的几何骰子 */
export function DiceMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-primary ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="white" strokeWidth="2" />
        <circle cx="9" cy="9" r="1.6" fill="white" />
        <circle cx="15" cy="15" r="1.6" fill="white" />
        <circle cx="12" cy="12" r="1.6" fill="white" />
      </svg>
    </span>
  )
}
