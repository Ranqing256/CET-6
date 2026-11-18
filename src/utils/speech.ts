const ENGLISH_LANGUAGE = /^en(?:[-_]|$)/i
const MAX_WAITING_SPEECH = 8
const BETWEEN_UTTERANCES_MS = 120

export interface SpeechOptions {
  voiceURI?: string
  rate?: number
}

interface SpeechJob extends SpeechOptions {
  text: string
  resolve: () => void
  reject: (error: Error) => void
}

const speechQueue: SpeechJob[] = []
let speechActive = false
let betweenUtterances = false

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices()
    .filter((voice) => ENGLISH_LANGUAGE.test(voice.lang))
    .sort((a, b) => {
      if (a.default !== b.default) return a.default ? -1 : 1
      return a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name)
    })
}

export function observeEnglishVoices(onChange: (voices: SpeechSynthesisVoice[]) => void): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return () => undefined

  const synthesis = window.speechSynthesis
  const refresh = () => onChange(getEnglishVoices())
  refresh()
  synthesis.addEventListener('voiceschanged', refresh)
  const retryTimer = window.setTimeout(refresh, 350)

  return () => {
    window.clearTimeout(retryTimer)
    synthesis.removeEventListener('voiceschanged', refresh)
  }
}

function chooseVoice(voices: SpeechSynthesisVoice[], preferredVoiceURI: string): SpeechSynthesisVoice | undefined {
  if (preferredVoiceURI) {
    const preferred = voices.find((voice) => voice.voiceURI === preferredVoiceURI)
    if (preferred) return preferred
  }
  return voices.find((voice) => /^en-US$/i.test(voice.lang))
    ?? voices.find((voice) => /^en-GB$/i.test(voice.lang))
    ?? voices.find((voice) => voice.default)
    ?? voices[0]
}

function speechErrorMessage(code: string): string {
  if (code === 'voice-unavailable' || code === 'language-unavailable') {
    return '所选英语音色暂不可用。已尝试自动切换；如果仍无法播放，请换一个音色。'
  }
  if (code === 'not-allowed') {
    return '浏览器阻止了语音播放。请直接点击单词旁的喇叭按钮后重试。'
  }
  if (code === 'audio-busy' || code === 'audio-hardware') {
    return '设备音频暂时不可用，请检查静音或输出设备后重试。'
  }
  if (code === 'canceled' || code === 'interrupted') {
    return '语音播放被设备中断。请稍后重试，或更换英语音色。'
  }
  return '这次没有成功播放。请切换英语音色，或检查当前设备的语音与音频设置。'
}

function startQueue(): void {
  if (speechActive || betweenUtterances || speechQueue.length === 0) return
  speechActive = true

  const job = speechQueue.shift()!
  const synthesis = window.speechSynthesis
  const allVoices = getEnglishVoices()
  const preferred = job.voiceURI ?? ''
  const selectedVoice = chooseVoice(allVoices, preferred)
  const rate = Math.max(0.8, Math.min(1.35, job.rate ?? 1.1))
  let settled = false
  let attempt = 0
  let startTimer: number | undefined

  const finish = (error?: Error) => {
    if (settled) return
    settled = true
    if (startTimer !== undefined) window.clearTimeout(startTimer)
    if (error) job.reject(error)
    else job.resolve()
    speechActive = false
    betweenUtterances = true
    window.setTimeout(() => {
      betweenUtterances = false
      startQueue()
    }, BETWEEN_UTTERANCES_MS)
  }

  const tryFallback = (failedVoice: SpeechSynthesisVoice | undefined, clearStalledRequest = false): boolean => {
    const fallback = chooseVoice(allVoices.filter((voice) => voice.voiceURI !== failedVoice?.voiceURI), '')
    if (!fallback || fallback.voiceURI === failedVoice?.voiceURI) return false
    if (startTimer !== undefined) window.clearTimeout(startTimer)
    if (clearStalledRequest) {
      attempt += 1
      try { synthesis.cancel() } catch { /* A stalled voice may not expose cancellation. */ }
    }
    launch(fallback, false)
    return true
  }

  const launch = (voice: SpeechSynthesisVoice | undefined, canFallback: boolean) => {
    const thisAttempt = ++attempt
    const utterance = new SpeechSynthesisUtterance(job.text)
    utterance.lang = voice?.lang || 'en-US'
    utterance.rate = rate
    utterance.pitch = 1
    if (voice) utterance.voice = voice
    let started = false

    utterance.onstart = () => {
      if (thisAttempt !== attempt || settled) return
      started = true
      if (startTimer !== undefined) window.clearTimeout(startTimer)
    }
    utterance.onend = () => {
      if (thisAttempt === attempt) finish()
    }
    utterance.onerror = (event) => {
      if (thisAttempt !== attempt || settled) return
      const voiceFailedBeforeAudio = !started
        && (event.error === 'voice-unavailable' || event.error === 'language-unavailable')
      if (voiceFailedBeforeAudio && canFallback && tryFallback(voice)) return
      finish(new Error(speechErrorMessage(event.error)))
    }

    startTimer = window.setTimeout(() => {
      if (thisAttempt !== attempt || settled || started) return
      if (canFallback && tryFallback(voice, true)) return
      finish(new Error('语音没有及时启动。请更换英语音色，或检查设备上的语音服务后重试。'))
    }, 6000)

    try {
      synthesis.resume()
      synthesis.speak(utterance)
    } catch {
      if (canFallback && tryFallback(voice)) return
      finish(new Error('浏览器无法启动语音。请刷新页面，或换一个英语音色再试。'))
    }
  }

  launch(selectedVoice, true)
}

export function speakEnglishWord(word: string, options: SpeechOptions = {}): Promise<void> {
  const text = word.trim().replace(/\s+/g, ' ')
  if (!text) return Promise.reject(new Error('没有可播放的英文内容。'))
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return Promise.reject(new Error('当前浏览器不支持语音朗读，请换用较新的浏览器。'))
  }
  if (speechQueue.length >= MAX_WAITING_SPEECH) {
    return Promise.reject(new Error('语音播放队列已满，请等当前单词播完再试。'))
  }

  return new Promise((resolve, reject) => {
    speechQueue.push({ text, voiceURI: options.voiceURI, rate: options.rate, resolve, reject })
    startQueue()
  })
}
