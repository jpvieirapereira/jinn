"use client"
import React, { useRef, useEffect } from "react"

interface SttWaveformProps {
  analyser: AnalyserNode
  width?: number
  height?: number
  color?: string
}

export function SttWaveform({
  analyser,
  width = 64,
  height = 32,
  color = "var(--system-red)",
}: SttWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const barCount = 12
    const barGap = 2
    const barWidth = (width - barGap * (barCount - 1)) / barCount

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      ctx!.clearRect(0, 0, width, height)

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * (bufferLength * 0.6))
        const value = dataArray[dataIndex] / 255
        const barHeight = Math.max(3, value * height)
        const x = i * (barWidth + barGap)
        const y = (height - barHeight) / 2

        ctx!.fillStyle = color
        ctx!.beginPath()
        ctx!.roundRect(x, y, barWidth, barHeight, 1.5)
        ctx!.fill()
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [analyser, width, height, color])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "block" }}
    />
  )
}
