const ENGLISH_LANGUAGE = /^en(?:[-_]|$)/i

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
    return '当前音色暂不可用。请在“英语发音”中换一个音色，或让浏览器自动选择。'
  }
  if (code === 'not-allowed') {
    return '浏览器阻止了语音播放。请直接点击单词旁的喇叭按钮后重试。'
  }
  if (code === 'audio-busy' || code === 'audio-hardware') {
    return '设备音频暂时不可用，请检查静音或输出设备后重试。'
  }
  return '这次没有成功播放。请切换英语音色，或检查当前设备的语音与音频设置。'
}

export function speakEnglishWord(word: string, preferredVoiceURI = ''): Promise<void> {
  const text = word.trim().replace(/\s+/g, ' ')
  if (!text) return Promise.reject(new Error('没有可播放的英文内容。'))
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return Promise.reject(new Error('当前浏览器不支持语音朗读，请换用较新的浏览器。'))
  }

  const synthesis = window.speechSynthesis
  const voice = chooseVoice(getEnglishVoices(), preferredVoiceURI)
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = voice?.lang || 'en-US'
  utterance.rate = 0.92
  utterance.pitch = 1
  if (voice) utterance.voice = voice

  synthesis.cancel()
  synthesis.resume()

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(startTimer)
      if (error) reject(error)
      else resolve()
    }

    utterance.onend = () => finish()
    utterance.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') {
        finish()
        return
      }
      finish(new Error(speechErrorMessage(event.error)))
    }

    const startTimer = window.setTimeout(() => {
      finish(new Error('语音没有启动。请点击后稍候，或更换英语音色再试。'))
    }, 6000)

    try {
      synthesis.speak(utterance)
    } catch {
      finish(new Error('浏览器无法启动语音。请刷新页面，或换一个英语音色再试。'))
    }
  })
}
