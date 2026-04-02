'use client'

interface Props {
  enabled: boolean
  onToggle: () => void
  label: string
  description?: string
}

export default function Toggle({ enabled, onToggle, label, description }: Props) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 rounded-sm border border-white/5 hover:border-white/10 transition-colors group"
    >
      <div className="flex flex-col gap-0.5 text-left">
        <span className="text-[11px] font-medium text-silver-400 group-hover:text-silver-400 uppercase tracking-wide">
          {label}
        </span>
        {description && (
          <span className="text-[9px] text-ink-600 font-mono">{description}</span>
        )}
      </div>

      {/* Toggle pill */}
      <div
        className={`relative w-8 h-4 rounded-full transition-colors duration-300 shrink-0 ${
          enabled ? 'bg-gold-600/40 border border-gold-600/50' : 'bg-ink-700 border border-white/5'
        }`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 ${
            enabled
              ? 'left-[18px] bg-gold-400 shadow-[0_0_6px_rgba(212,160,23,0.6)]'
              : 'left-0.5 bg-silver-600'
          }`}
        />
      </div>
    </button>
  )
}
