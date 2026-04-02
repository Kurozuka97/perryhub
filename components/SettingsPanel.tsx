'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { UserSettings, DNS_OPTIONS } from '@/lib/types'
import Toggle from './Toggle'

interface Props {
  open: boolean
  onClose: () => void
  settings: UserSettings
  onSave: (updates: Partial<UserSettings>) => void
  langs: string[]
  uid: string
  status: 'connecting' | 'online' | 'error'
}

export default function SettingsPanel({ open, onClose, settings, onSave, langs, uid, status }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 bottom-0 z-[201] w-72 flex flex-col"
            style={{ background: '#0C0C12', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h2
                  className="text-lg font-light text-white leading-none mb-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Config
                </h2>
                <p className="font-mono text-[9px] text-ink-600 uppercase tracking-widest">Cloud Synced</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-silver-600 hover:text-white transition-colors border border-white/5 hover:border-white/15 rounded-sm"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-7">
              {/* Preferences */}
              <section className="space-y-3">
                <p className="font-mono text-[9px] text-ink-600 uppercase tracking-[0.25em]">Preferences</p>
                <Toggle
                  enabled={settings.showNSFW}
                  onToggle={() => onSave({ showNSFW: !settings.showNSFW })}
                  label="NSFW Overlay"
                  description="Show 18+ sources"
                />
                <div className="p-3 border border-white/5 rounded-sm space-y-2">
                  <p className="text-[11px] font-medium text-silver-400 uppercase tracking-wide">Language</p>
                  <select
                    value={settings.prefLang}
                    onChange={(e) => onSave({ prefLang: e.target.value })}
                    className="w-full bg-ink-900 border border-white/5 rounded-sm px-2 py-2 text-[10px] text-silver-400 font-mono outline-none hover:border-gold-600/30 transition-colors uppercase cursor-pointer"
                  >
                    <option value="all">Global</option>
                    {langs.map(l => (
                      <option key={l} value={l}>{l.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </section>

              {/* Network */}
              <section className="space-y-3">
                <p className="font-mono text-[9px] text-ink-600 uppercase tracking-[0.25em]">Network</p>
                <div className="p-3 border border-white/5 rounded-sm space-y-2">
                  <p className="text-[11px] font-medium text-silver-400 uppercase tracking-wide">DNS Provider</p>
                  <select
                    value={settings.dnsProvider}
                    onChange={(e) => onSave({ dnsProvider: e.target.value })}
                    className="w-full bg-ink-900 border border-white/5 rounded-sm px-2 py-2 text-[10px] text-silver-400 font-mono outline-none hover:border-gold-600/30 transition-colors uppercase cursor-pointer"
                  >
                    {DNS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </section>

              {/* Vault status */}
              <section className="space-y-3">
                <p className="font-mono text-[9px] text-ink-600 uppercase tracking-[0.25em]">Vault</p>
                <div className="p-3 border border-white/5 rounded-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      status === 'online' ? 'bg-gold-500 animate-pulse-slow' :
                      status === 'error' ? 'bg-crimson-500' : 'bg-silver-600'
                    }`} />
                    <span className={`font-mono text-[9px] uppercase ${
                      status === 'online' ? 'text-gold-500' :
                      status === 'error' ? 'text-crimson-400' : 'text-silver-600'
                    }`}>
                      {status === 'online' ? 'Cloud Online' : status === 'error' ? 'Sync Error' : 'Connecting...'}
                    </span>
                  </div>
                  {uid && (
                    <p className="font-mono text-[8px] text-ink-600 break-all">
                      {uid.substring(0, 16)}...
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 shrink-0">
              <button
                onClick={onClose}
                className="w-full py-2.5 font-mono text-[9px] uppercase tracking-widest text-silver-600 hover:text-white border border-white/5 hover:border-white/15 rounded-sm transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
