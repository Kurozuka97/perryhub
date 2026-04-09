'use client'
import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

interface Props {
  url: string
  name: string
  onClose: () => void
}

type PlayerStatus = 'loading' | 'playing' | 'error'

export default function IPTVPlayer({ url, name, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<PlayerStatus>('loading')
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setStatus('loading')

    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => setStatus('error'))
        setStatus('playing')
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setStatus('error')
      })
      return () => hls.destroy()
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      video.play().catch(() => setStatus('error'))
      video.onplaying = () => setStatus('playing')
      video.onerror = () => setStatus('error')
    } else {
      setStatus('error')
    }
  }, [url])

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      const target = containerRef.current
      if (target) target.requestFullscreen().catch(() => {})
    }
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#000', width: '100%', height: '100%', maxWidth: '100vw', maxHeight: '100vh' }}>
      {/* Navbar */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-3"
        style={{ background: 'rgba(6,13,14,0.95)', borderBottom: '1px solid rgba(0,201,201,0.1)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: status === 'playing' ? '#00ff88' : status === 'error' ? '#ff4444' : '#ff8c42',
              animation: status === 'loading' ? 'pulse 1.5s infinite' : 'none',
            }}
          />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#00c9c9', textTransform: 'uppercase', letterSpacing: 1 }}>
            {status === 'playing' ? 'LIVE' : status === 'error' ? 'ERROR' : 'LOADING'}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#a0c4c4', textTransform: 'uppercase' }}>
            {name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Fullscreen button */}
          <button
            onClick={handleFullscreen}
            className="flex items-center gap-2 px-3 py-1.5 rounded transition-all"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a8888', border: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase', letterSpacing: 1 }}
            onMouseEnter={e => e.currentTarget.style.color = '#e8f5f5'}
            onMouseLeave={e => e.currentTarget.style.color = '#4a8888'}
          >
            {isFullscreen ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            )}
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded transition-all"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#4a8888', border: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase', letterSpacing: 1 }}
            onMouseEnter={e => e.currentTarget.style.color = '#e8f5f5'}
            onMouseLeave={e => e.currentTarget.style.color = '#4a8888'}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Close
          </button>
        </div>
      </div>

      {/* Error State */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10" style={{ background: '#060d0e' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,68,68,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#ff4444', textTransform: 'uppercase', letterSpacing: 2 }}>
            Stream Unavailable
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#1a3a3a', textTransform: 'uppercase', letterSpacing: 1 }}>
            {name}
          </p>
          <button
            onClick={onClose}
            className="mt-2 px-5 py-2 rounded transition-all"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#00c9c9', border: '1px solid rgba(0,201,201,0.2)', textTransform: 'uppercase', letterSpacing: 1 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,201,201,0.5)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,201,201,0.2)'}
          >
            Go Back
          </button>
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        className="flex-1 w-full"
        controls
        autoPlay
        playsInline
        style={{
          background: '#000',
          objectFit: 'contain',
          display: status === 'error' ? 'none' : 'block',
          width: '100%',
          height: '100%',
          maxWidth: '100vw',
          maxHeight: isFullscreen ? '100vh' : 'calc(100vh - 48px)',
        }}
      />
    </div>
  )
}
