'use client'
import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

interface Props {
  url: string
  name: string
  onClose: () => void
}

export default function IPTVPlayer({ url, name, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (Hls.isSupported()) {
      const hls = new Hls()
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}))
      return () => hls.destroy()
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      video.play().catch(() => {})
    }
  }, [url])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#000' }}>
      {/* Navbar */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-3"
        style={{ background: 'rgba(6,13,14,0.95)', borderBottom: '1px solid rgba(0,201,201,0.1)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#00c9c9', textTransform: 'uppercase', letterSpacing: 1 }}>
            LIVE
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#a0c4c4', textTransform: 'uppercase' }}>
            {name}
          </span>
        </div>
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

      {/* Video */}
      <video
        ref={videoRef}
        className="flex-1 w-full"
        controls
        autoPlay
        playsInline
        style={{ background: '#000', objectFit: 'contain' }}
      />
    </div>
  )
}
