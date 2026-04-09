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
            className="fixed inset-0 z-[200]"
          />

          {/* Dropdown anchored to top-right, below navbar */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed right-4 top-16 z-[201] w-72 flex flex-col overflow-hidden"
            style={{
              background: '#0a1a1b',
              border: '1px solid rgba(0,201,201,0.12)',
              borderRadius: 8,
              boxShadow: '0 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,201,201,0.04)',
            }}
          >
            {/* Account Header */}
            <div
              className="flex flex-col items-center py-6 px-6 gap-3"
              style={{ background: 'linear-gradient(160deg, rgba(0,201,201,0.1) 0%, transparent 100%)', borderBottom: '1px solid rgba(0,201,201,0.08)' }}
            >
              {/* Avatar */}
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: authMode === 'user' ? 'rgba(0,201,201,0.15)' : 'rgba(255,255,255,0.05)',
                border: authMode === 'user' ? '1px solid rgba(0,201,201,0.3)' : '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {authMode === 'user' && perryId ? (
                  <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, color: '#00c9c9', lineHeight: 1 }}>
                    {perryId.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(232,245,245,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                )}
              </div>

              {/* Name + status */}
              <div className="text-center">
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#e8f5f5', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500 }}>
                  {authMode === 'user' && perryId ? perryId : 'Guest'}
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${authMode === 'user' ? 'bg-teal-400 animate-pulse' : 'bg-zinc-600'}`} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: authMode === 'user' ? '#00c9c9' : '#6ababa', textTransform: 'uppercase', letterSpacing: 2 }}>
                    {authMode === 'user' ? 'Perry Hub ID · Synced' : 'Guest Session · Not Synced'}
                  </span>
                </div>
              </div>

              {/* Vault status pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  status === 'online' ? 'bg-teal-400 animate-pulse' :
                  status === 'error' ? 'bg-red-500' : 'bg-zinc-600'
                }`} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, textTransform: 'uppercase', letterSpacing: 2, color:
                  status === 'online' ? '#00c9c9' : status === 'error' ? '#ff4444' : '#6ababa'
                }}>
                  {status === 'online' ? 'Cloud Online' : status === 'error' ? 'Sync Error' : 'Connecting...'}
                </span>
                {uid && (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: 'rgba(232,245,245,0.25)', letterSpacing: 1 }}>
                    · {uid.substring(0, 8)}
                  </span>
                )}
              </div>
            </div>

            {/* Config sections */}
            <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(0,201,201,0.06)' }}>

              {/* NSFW Toggle */}
              <div className="px-4 py-3">
                <Toggle
                  enabled={settings.showNSFW}
                  onToggle={() => onSave({ showNSFW: !settings.showNSFW })}
                  label="NSFW Overlay"
                  description="Show 18+ sources"
                />
              </div>

              {/* Language */}
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#e8f5f5', textTransform: 'uppercase', letterSpacing: 1 }}>Language</p>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>Source filter</p>
                </div>
                <select
                  value={settings.prefLang}
                  onChange={(e) => onSave({ prefLang: e.target.value })}
                  className="outline-none cursor-pointer"
                  style={{
                    background: 'rgba(0,201,201,0.06)',
                    border: '1px solid rgba(0,201,201,0.15)',
                    borderRadius: 4,
                    padding: '4px 8px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    color: '#00c9c9',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    minWidth: 80,
                  }}
                >
                  <option value="all">Global</option>
                  {langs.map(l => (
                    <option key={l} value={l}>{l.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* DNS */}
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#e8f5f5', textTransform: 'uppercase', letterSpacing: 1 }}>DNS</p>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>Network provider</p>
                </div>
                <select
                  value={settings.dnsProvider}
                  onChange={(e) => onSave({ dnsProvider: e.target.value })}
                  className="outline-none cursor-pointer"
                  style={{
                    background: 'rgba(0,201,201,0.06)',
                    border: '1px solid rgba(0,201,201,0.15)',
                    borderRadius: 4,
                    padding: '4px 8px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    color: '#00c9c9',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    minWidth: 80,
                  }}
                >
                  {DNS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer actions */}
            <div className="p-3 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(0,201,201,0.08)' }}>
              {authMode === 'user' && (
                <button
                  onClick={() => { onLogout(); onClose() }}
                  className="w-full py-2 rounded transition-all"
                  style={{ border: '1px solid rgba(255,68,68,0.2)', color: '#ff4444', background: 'transparent', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,68,68,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Logout
                </button>
              )}
              {authMode === 'guest' && (
                <button
                  onClick={() => { onLogout(); onClose() }}
                  className="w-full py-2 rounded transition-all"
                  style={{ border: '1px solid rgba(0,201,201,0.15)', color: '#00c9c9', background: 'transparent', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,201,201,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Leave Guest
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-2 rounded transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(232,245,245,0.4)', background: 'transparent', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#e8f5f5'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(232,245,245,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
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
