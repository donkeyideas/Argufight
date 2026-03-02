/**
 * Deepgram WebSocket Client for Real-time Speech-to-Text
 * Handles streaming audio transcription without timeout issues
 */

export interface DeepgramTranscriptionResult {
  transcript: string
  isFinal: boolean
  confidence?: number
}

export class DeepgramClient {
  private ws: WebSocket | null = null
  private apiKey: string
  private onTranscript: (result: DeepgramTranscriptionResult) => void
  private onError: (error: Error) => void
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private isConnected = false

  constructor(
    apiKey: string,
    onTranscript: (result: DeepgramTranscriptionResult) => void,
    onError: (error: Error) => void
  ) {
    this.apiKey = apiKey
    this.onTranscript = onTranscript
    this.onError = onError
  }

  async start(mediaStream: MediaStream): Promise<void> {
    try {
      this.mediaStream = mediaStream

      // Create WebSocket connection to Deepgram
      const wsUrl = `wss://api.deepgram.com/v1/listen?language=en-US&punctuate=true&interim_results=true`
      this.ws = new WebSocket(wsUrl, ['token', this.apiKey])

      this.ws.onopen = async () => {
        console.log('Deepgram WebSocket connected')
        this.isConnected = true
        
        // Ensure AudioContext is running before starting stream
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume()
        }
        
        await this.startAudioStream(mediaStream)
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript || ''
            const isFinal = data.is_final || false
            const confidence = data.channel?.alternatives?.[0]?.confidence

            if (transcript) {
              this.onTranscript({
                transcript,
                isFinal,
                confidence,
              })
            }
          } else if (data.type === 'Metadata') {
            // Connection metadata
            console.log('Deepgram metadata:', data)
          }
        } catch (error) {
          console.error('Failed to parse Deepgram message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error)
        this.onError(new Error('Deepgram connection error'))
      }

      this.ws.onclose = (event) => {
        console.log('Deepgram WebSocket closed', { code: event.code, reason: event.reason, wasClean: event.wasClean })
        this.isConnected = false
        
        // Only cleanup if it was a clean close or user-initiated
        // If it was an unexpected close, try to reconnect
        if (event.code !== 1000 && event.code !== 1001) {
          console.warn('Deepgram WebSocket closed unexpectedly, attempting to reconnect...')
          // Don't cleanup immediately - let the error handler decide
        } else {
          this.cleanup()
        }
      }
    } catch (error: any) {
      console.error('Failed to start Deepgram:', error)
      this.onError(error)
    }
  }

  private async startAudioStream(mediaStream: MediaStream): Promise<void> {
    try {
      // Create AudioContext and ensure it's running
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Resume AudioContext if suspended (browsers suspend it by default)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      
      // Monitor AudioContext state changes
      this.audioContext.onstatechange = () => {
        console.log('AudioContext state changed to:', this.audioContext?.state)
        if (this.audioContext?.state === 'suspended' && this.isConnected) {
          // Auto-resume if suspended while connected
          this.audioContext.resume().catch(err => {
            console.error('Failed to resume AudioContext:', err)
          })
        }
      }

      // Ensure all tracks are active
      mediaStream.getTracks().forEach(track => {
        if (track.readyState === 'ended') {
          console.warn('MediaStream track ended, this should not happen')
        }
        // Monitor track state
        track.onended = () => {
          console.error('MediaStream track ended unexpectedly!')
          this.onError(new Error('Microphone track ended'))
        }
      })

      const source = this.audioContext.createMediaStreamSource(mediaStream)

      // Create script processor for audio chunks
      // Use smaller buffer size for lower latency (2048 instead of 4096)
      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1)

      let audioChunkCount = 0
      this.processor.onaudioprocess = (event) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.audioContext?.state === 'running') {
          const inputData = event.inputBuffer.getChannelData(0)
          
          // Check if we're actually getting audio data (not just silence)
          const hasAudio = inputData.some(sample => Math.abs(sample) > 0.001)
          
          // Convert Float32Array to Int16Array for Deepgram
          const int16Data = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            // Clamp and convert to 16-bit PCM
            const s = Math.max(-1, Math.min(1, inputData[i]))
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }

          // Send audio data to Deepgram
          try {
            this.ws.send(int16Data.buffer)
            audioChunkCount++
            
            // Log every 100 chunks (roughly every 2-3 seconds at 48kHz)
            if (audioChunkCount % 100 === 0) {
              console.log(`[Deepgram] Sent ${audioChunkCount} audio chunks, AudioContext state: ${this.audioContext?.state}`)
            }
          } catch (error) {
            console.error('Failed to send audio chunk to Deepgram:', error)
          }
        } else {
          // Log why we're not sending
          if (!this.ws) {
            console.warn('[Deepgram] WebSocket not initialized')
          } else if (this.ws.readyState !== WebSocket.OPEN) {
            console.warn(`[Deepgram] WebSocket not open (state: ${this.ws.readyState})`)
          } else if (this.audioContext?.state !== 'running') {
            console.warn(`[Deepgram] AudioContext not running (state: ${this.audioContext?.state}), attempting to resume...`)
            this.audioContext?.resume().catch(err => {
              console.error('Failed to resume AudioContext:', err)
            })
          }
        }
      }

      source.connect(this.processor)
      // Connect to destination to keep the audio graph active
      // This prevents the browser from suspending the AudioContext
      this.processor.connect(this.audioContext.destination)
      
      console.log('[Deepgram] Audio stream started, AudioContext state:', this.audioContext.state)
    } catch (error: any) {
      console.error('Failed to start audio stream:', error)
      this.onError(error)
    }
  }

  stop(): void {
    this.cleanup()
  }

  private cleanup(): void {
    if (this.processor) {
      try {
        this.processor.disconnect()
      } catch (e) {
        // Ignore
      }
      this.processor = null
    }

    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch (e) {
        // Ignore
      }
      this.audioContext = null
    }

    if (this.ws) {
      try {
        this.ws.close()
      } catch (e) {
        // Ignore
      }
      this.ws = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    this.isConnected = false
  }

  isActive(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN
  }
}

