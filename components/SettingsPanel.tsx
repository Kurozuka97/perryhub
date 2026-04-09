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

const mono = 'JetBrains Mono, monospace'
const display = 'Bebas Neue, sans-serif'

export default function SettingsPanel({ open, onClose, settings, onSave, langs, uid, status, perryId, authMode, onLogout }: Props) {
  const isUser = authMode === 'user' && !!perryId
  const statusColor = status === 'online' ? '#00c9c9' : status === 'error' ? '#ff4444' : '#7ecece'
  const statusLabel = status === 'online' ? 'Cloud Online' : status === 'error' ? 'Sync Error' : 'Connecting...'

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

          {/* Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            className="fixed right-4 top-16 z-[201] w-80 flex flex-col overflow-hidden"
            style={{
              background: '#081414',
              border: '1px solid rgba(0,201,201,0.18)',
              borderRadius: 10,
              boxShadow: '0 32px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,201,201,0.06)',
            }}
          >
            {/* ── HEADER ── */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,201,201,0.12) 0%, rgba(0,201,201,0.03) 100%)',
              borderBottom: '1px solid rgba(0,201,201,0.1)',
              padding: '20px 20px 16px',
            }}>
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div style={{
                  width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                  background: isUser ? 'rgba(0,201,201,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${isUser ? 'rgba(0,201,201,0.35)' : 'rgba(255,255,255,0.1)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isUser ? (
                    <span style={{ fontFamily: display, fontSize: 26, color: '#00c9c9', lineHeight: 1 }}>
                      {perryId!.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7ecece" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: mono, fontSize: 15, color: '#e8f5f5', letterSpacing: 2, lineHeight: 1, fontWeight: 600 }}>
                    {isUser ? perryId : 'Guest'}
                  </p>
                  <p style={{ fontFamily: mono, fontSize: 9, color: isUser ? '#00c9c9' : '#7ecece', textTransform: 'uppercase', letterSpacing: 2, marginTop: 5 }}>
                    {isUser ? 'Perry Hub ID' : 'Guest Session'}
                  </p>

                  {/* Sync badge */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: isUser ? '#00c9c9' : '#444',
                      boxShadow: isUser ? '0 0 6px #00c9c9' : 'none',
                    }} />
                    <span style={{ fontFamily: mono, fontSize: 8, color: isUser ? '#00c9c9' : '#6ababa', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                      {isUser ? 'Synced' : 'Not Synced'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vault pill */}
              <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-md" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: statusColor,
                  boxShadow: status === 'online' ? `0 0 6px ${statusColor}` : 'none',
                  flexShrink: 0,
                }} />
                <span style={{ fontFamily: mono, fontSize: 9, color: statusColor, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {statusLabel}
                </span>
                {uid && (
                  <span style={{ fontFamily: mono, fontSize: 8, color: 'rgba(232,245,245,0.3)', letterSpacing: 1, marginLeft: 'auto' }}>
                    {uid.substring(0, 10)}…
                  </span>
                )}
              </div>
            </div>

            {/* ── SETTINGS ── */}
            <div style={{ borderBottom: '1px solid rgba(0,201,201,0.08)' }}>

              {/* NSFW */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <Toggle
                  enabled={settings.showNSFW}
                  onToggle={() => onSave({ showNSFW: !settings.showNSFW })}
                  label="NSFW Overlay"
                  description="Show 18+ sources"
                />
              </div>

              {/* Language */}
              <div className="flex items-center justify-between" style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <p style={{ fontFamily: mono, fontSize: 11, color: '#c8e8e8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>Language</p>
                  <p style={{ fontFamily: mono, fontSize: 8, color: '#5aacac', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>Source filter</p>
                </div>
                <select
                  value={settings.prefLang}
                  onChange={(e) => onSave({ prefLang: e.target.value })}
                  className="outline-none cursor-pointer"
                  style={{
                    background: 'rgba(0,201,201,0.08)',
                    border: '1px solid rgba(0,201,201,0.2)',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontFamily: mono,
                    fontSize: 10,
                    color: '#00c9c9',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    minWidth: 90,
                  }}
                >
                  <option value="all">Global</option>
                  {langs.map(l => (
                    <option key={l} value={l}>{l.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* DNS */}
              <div className="flex items-center justify-between" style={{ padding: '12px 20px' }}>
                <div>
                  <p style={{ fontFamily: mono, fontSize: 11, color: '#c8e8e8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>DNS</p>
                  <p style={{ fontFamily: mono, fontSize: 8, color: '#5aacac', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>Network provider</p>
                </div>
                <select
                  value={settings.dnsProvider}
                  onChange={(e) => onSave({ dnsProvider: e.target.value })}
                  className="outline-none cursor-pointer"
                  style={{
                    background: 'rgba(0,201,201,0.08)',
                    border: '1px solid rgba(0,201,201,0.2)',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontFamily: mono,
                    fontSize: 10,
                    color: '#00c9c9',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    minWidth: 90,
                  }}
                >
                  {DNS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {authMode === 'user' && (
                <button
                  onClick={() => { onLogout(); onClose() }}
                  className="w-full rounded-md transition-all"
                  style={{
                    padding: '10px 0',
                    border: '1px solid rgba(255,68,68,0.25)',
                    color: '#ff6060',
                    background: 'rgba(255,68,68,0.05)',
                    fontFamily: mono,
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,68,68,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,68,68,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,68,68,0.25)' }}
                >
                  Logout
                </button>
              )}
              {authMode === 'guest' && (
                <button
                  onClick={() => { onLogout(); onClose() }}
                  className="w-full rounded-md transition-all"
                  style={{
                    padding: '10px 0',
                    border: '1px solid rgba(0,201,201,0.25)',
                    color: '#00c9c9',
                    background: 'rgba(0,201,201,0.06)',
                    fontFamily: mono,
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,201,201,0.12)'; e.currentTarget.style.borderColor = 'rgba(0,201,201,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,201,201,0.06)'; e.currentTarget.style.borderColor = 'rgba(0,201,201,0.25)' }}
                >
                  Leave Guest
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full rounded-md transition-all"
                style={{
                  padding: '8px 0',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: 'rgba(232,245,245,0.5)',
                  background: 'transparent',
                  fontFamily: mono,
                  fontSize: 9,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#e8f5f5'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(232,245,245,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
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
