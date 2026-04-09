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
  perryId: string | null
  authMode: 'loading' | 'auth' | 'guest' | 'user'
  onLogout: () => void
}

export default function SettingsPanel({ open, onClose, settings, onSave, langs, uid, status, perryId, authMode, onLogout }: Props) {
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
                <h2 className="text-lg font-light text-white leading-none mb-1" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>
                  Config
                </h2>
                <p className="font-mono text-[9px] text-zinc-400 uppercase tracking-widest">
                  {authMode === 'user' ? 'Perry Hub Account' : 'Guest Session'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors border border-white/5 hover:border-white/15 rounded-sm"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-7">

              {/* Account */}
              <section className="space-y-3">
                <p className="font-mono text-[9px] text-zinc-400 uppercase tracking-[0.25em]">Account</p>
                <div className="p-3 border border-white/5 rounded-sm space-y-3">
                  {authMode === 'user' && perryId ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                          background: 'rgba(0,201,201,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, color: '#00c9c9',
                        }}>
                          {perryId.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white uppercase" style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1 }}>
                            {perryId}
                          </p>
                          <p className="font-mono text-[8px] text-zinc-400 uppercase tracking-wide mt-0.5">
                            Perry Hub ID
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                        <span className="font-mono text-[9px] text-teal-400 uppercase">Synced</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                        <span className="font-mono text-[9px] text-zinc-400 uppercase">Guest — not synced</span>
                      </div>
                      <p className="font-mono text-[8px] text-zinc-400 uppercase leading-relaxed">
                        Settings won't persist across devices
                      </p>
                    </>
                  )}
                </div>
              </section>

              {/* Preferences */}
              <section className="space-y-3">
                <p className="font-mono text-[9px] text-zinc-400 uppercase tracking-[0.25em]">Preferences</p>
                <Toggle
                  enabled={settings.showNSFW}
                  onToggle={() => onSave({ showNSFW: !settings.showNSFW })}
                  label="NSFW Overlay"
                  description="Show 18+ sources"
                />
                <div className="p-3 border border-white/5 rounded-sm space-y-2">
                  <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Language</p>
                  <select
                    value={settings.prefLang}
                    onChange={(e) => onSave({ prefLang: e.target.value })}
                    className="w-full bg-transparent border border-white/5 rounded-sm px-2 py-2 text-[10px] text-zinc-400 font-mono outline-none uppercase cursor-pointer"
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
                <p className="font-mono text-[9px] text-zinc-400 uppercase tracking-[0.25em]">Network</p>
                <div className="p-3 border border-white/5 rounded-sm space-y-2">
                  <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">DNS Provider</p>
                  <select
                    value={settings.dnsProvider}
                    onChange={(e) => onSave({ dnsProvider: e.target.value })}
                    className="w-full bg-transparent border border-white/5 rounded-sm px-2 py-2 text-[10px] text-zinc-400 font-mono outline-none uppercase cursor-pointer"
                  >
                    {DNS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </section>

              {/* Vault status */}
              <section className="space-y-3">
                <p className="font-mono text-[9px] text-zinc-400 uppercase tracking-[0.25em]">Vault</p>
                <div className="p-3 border border-white/5 rounded-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      status === 'online' ? 'bg-teal-400 animate-pulse' :
                      status === 'error' ? 'bg-red-500' : 'bg-zinc-600'
                    }`} />
                    <span className={`font-mono text-[9px] uppercase ${
                      status === 'online' ? 'text-teal-400' :
                      status === 'error' ? 'text-red-400' : 'text-zinc-400'
                    }`}>
                      {status === 'online' ? 'Cloud Online' : status === 'error' ? 'Sync Error' : 'Connecting...'}
                    </span>
                  </div>
                  {uid && (
                    <p className="font-mono text-[8px] text-zinc-400 break-all">
                      {uid.substring(0, 16)}...
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 shrink-0 space-y-2">
              {authMode === 'user' && (
                <button
                  onClick={() => { onLogout(); onClose() }}
                  className="w-full py-2.5 font-mono text-[9px] uppercase tracking-widest transition-colors rounded-sm"
                  style={{ border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444', background: 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,68,68,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Logout
                </button>
              )}
              {authMode === 'guest' && (
                <button
                  onClick={() => { onLogout(); onClose() }}
                  className="w-full py-2.5 font-mono text-[9px] uppercase tracking-widest transition-colors rounded-sm"
                  style={{ border: '1px solid rgba(0,201,201,0.15)', color: '#00c9c9', background: 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,201,201,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Leave Guest
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-2.5 font-mono text-[9px] uppercase tracking-widest text-zinc-400 hover:text-white border border-white/5 hover:border-white/15 rounded-sm transition-colors"
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
