'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  onGuest: () => void
  onLogin: (id: string, password: string) => Promise<boolean>
  onRegister: (id: string, password: string) => Promise<boolean>
}

type Mode = 'welcome' | 'login' | 'register'

export default function AuthScreen({ onGuest, onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<Mode>('welcome')
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!id.trim() || !password.trim()) {
      setError('Fill in both fields')
      return
    }
    if (id.length < 3) {
      setError('ID must be at least 3 characters')
      return
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }

    setLoading(true)
    setError('')

    const success = mode === 'login'
      ? await onLogin(id.trim(), password)
      : await onRegister(id.trim(), password)

    if (!success) {
      setError(mode === 'login' ? 'Wrong ID or password' : 'ID already taken')
    }
    setLoading(false)
  }

  const handleBack = () => {
    setMode('welcome')
    setError('')
    setId('')
    setPassword('')
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: '#060d0e' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,180,180,0.08) 0%, transparent 70%)'
      }} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm mx-4"
        style={{
          background: '#0a1a1b',
          border: '1px solid rgba(0,201,201,0.12)',
          borderRadius: 8,
          padding: 32,
        }}
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: 4, color: '#00c9c9' }}>
            PERRY HUB
          </h1>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6ababa', textTransform: 'uppercase', letterSpacing: 3, marginTop: 4 }}>
            {mode === 'welcome' ? 'Official Portal of Truck-Kun Survivors' : mode === 'login' ? 'Welcome back' : 'Create account'}
          </p>
        </div>

        {/* Welcome mode */}
        {mode === 'welcome' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode('login')}
              className="w-full py-3 rounded transition-colors cursor-pointer bg-[rgba(0,201,201,0.1)] hover:bg-[rgba(0,201,201,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
              style={{
                border: '1px solid rgba(0,201,201,0.25)',
                color: '#00c9c9',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className="w-full py-3 rounded transition-colors cursor-pointer bg-transparent text-[#7ecece] hover:text-[#00c9c9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
              style={{
                border: '1px solid rgba(0,201,201,0.12)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Create ID
            </button>
            <div style={{ height: 1, background: 'rgba(0,201,201,0.06)', margin: '4px 0' }} />
            <button
              onClick={onGuest}
              className="w-full py-3 rounded transition-colors cursor-pointer bg-transparent text-[#b8e0e0] hover:text-[#e8f5f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
              style={{
                border: 'none',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Continue as Guest
            </button>
          </div>
        )}

        {/* Login / Register mode */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="auth-id" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#7ecece', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
                Perry Hub ID
              </label>
              <input
                id="auth-id"
                type="text"
                value={id}
                onChange={e => { setId(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="your-id"
                autoFocus
                className="w-full bg-transparent outline-none border-0 border-b border-[rgba(0,201,201,0.2)] focus:border-[#00c9c9]"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color: '#e8f5f5',
                  paddingBottom: 8,
                }}
              />
            </div>

            <div>
              <label htmlFor="auth-password" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#7ecece', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="••••••••"
                className="w-full bg-transparent outline-none border-0 border-b border-[rgba(0,201,201,0.2)] focus:border-[#00c9c9]"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color: '#e8f5f5',
                  paddingBottom: 8,
                }}
              />
            </div>

            {error && (
              <p role="alert" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#ff4444', textTransform: 'uppercase', letterSpacing: 1 }}>
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full py-3 rounded transition-colors mt-2 border border-[rgba(0,201,201,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9] ${loading ? 'cursor-not-allowed bg-[rgba(0,201,201,0.05)] text-[#4a9090]' : 'cursor-pointer bg-[rgba(0,201,201,0.1)] text-[#00c9c9] hover:bg-[rgba(0,201,201,0.18)]'}`}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create ID'}
            </button>

            <div className="flex items-center justify-between mt-1">
              <button
                onClick={handleBack}
                className="bg-transparent border-0 p-0 cursor-pointer text-[#6ababa] hover:text-[#7ecece] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}
              >
                ← Back
              </button>
              <button
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
                className="bg-transparent border-0 p-0 cursor-pointer text-[#6ababa] hover:text-[#7ecece] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}
              >
                {mode === 'login' ? 'Create new ID' : 'Already have ID'}
              </button>
              <button
                onClick={onGuest}
                className="bg-transparent border-0 p-0 cursor-pointer text-[#b8e0e0] hover:text-[#e8f5f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00c9c9]"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}
              >
                Guest
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
