import { useState, useEffect, useRef } from 'react'
import './CameraCaptureModal.css'

/**
 * A real in-browser camera capture UI (getUserMedia + canvas snapshot).
 * The native `<input type="file" capture>` trick only opens the camera app
 * on mobile — on desktop it silently falls back to a plain file picker,
 * which is confusing. This component gives a consistent camera experience
 * on both.
 */
export default function CameraCaptureModal({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [cameras, setCameras] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [error, setError] = useState('')
  const [capturedUrl, setCapturedUrl] = useState(null)
  const [capturedBlob, setCapturedBlob] = useState(null)

  useEffect(() => {
    startStream(null)
    return () => stopStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  async function startStream(preferredDeviceId) {
    stopStream()
    setError('')
    try {
      const constraints = {
        video: preferredDeviceId
          ? { deviceId: { exact: preferredDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setCameras(videoDevices)
      const activeTrack = stream.getVideoTracks()[0]
      const settings = activeTrack?.getSettings?.() || {}
      setDeviceId(preferredDeviceId || settings.deviceId || videoDevices[0]?.deviceId || '')
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Camera permission was denied. Please allow camera access in your browser settings and try again.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera was found on this device.')
      } else {
        setError('Camera error: ' + err.message)
      }
    }
  }

  function switchCamera(id) {
    setDeviceId(id)
    startStream(id)
  }

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      if (!blob) return
      setCapturedBlob(blob)
      setCapturedUrl(URL.createObjectURL(blob))
      stopStream()
    }, 'image/jpeg', 0.92)
  }

  function retake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedUrl(null)
    setCapturedBlob(null)
    startStream(deviceId || null)
  }

  function usePhoto() {
    if (!capturedBlob) return
    const file = new File([capturedBlob], `card_capture_${Date.now()}.jpg`, { type: 'image/jpeg' })
    onCapture(file)
  }

  function handleClose() {
    stopStream()
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    onClose()
  }

  return (
    <div className="ccm-overlay" onClick={handleClose}>
      <div className="ccm-box" onClick={e => e.stopPropagation()}>
        <div className="ccm-header">
          <span><i className="fas fa-camera"></i> Scan Visiting Card</span>
          <button className="ccm-close" onClick={handleClose}><i className="fas fa-times"></i></button>
        </div>

        {error ? (
          <div className="ccm-error">
            <i className="fas fa-exclamation-triangle"></i>
            <p>{error}</p>
            <button className="ccm-retry-btn" onClick={() => startStream(deviceId || null)}>Try Again</button>
          </div>
        ) : (
          <>
            <div className="ccm-video-wrap" style={{ display: capturedUrl ? 'none' : 'block' }}>
              <video ref={videoRef} autoPlay playsInline muted />
              <div className="ccm-frame">
                <div className="ccm-frame-box">
                  <span className="ccm-corner tl"></span>
                  <span className="ccm-corner tr"></span>
                  <span className="ccm-corner bl"></span>
                  <span className="ccm-corner br"></span>
                </div>
              </div>
              <div className="ccm-scanline"></div>
            </div>

            {capturedUrl && (
              <img className="ccm-preview" src={capturedUrl} alt="Captured card" />
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {cameras.length > 1 && !capturedUrl && (
              <select className="ccm-camera-select" value={deviceId} onChange={e => switchCamera(e.target.value)}>
                {cameras.map((c, i) => (
                  <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>
                ))}
              </select>
            )}

            <div className="ccm-actions">
              {!capturedUrl ? (
                <button className="ccm-btn primary" onClick={capturePhoto}>
                  <i className="fas fa-camera"></i> Capture Card
                </button>
              ) : (
                <>
                  <button className="ccm-btn ghost" onClick={retake}>
                    <i className="fas fa-redo"></i> Retake
                  </button>
                  <button className="ccm-btn success" onClick={usePhoto}>
                    <i className="fas fa-check"></i> Use This Photo
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
