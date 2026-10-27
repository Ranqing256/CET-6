export function speakEnglishWord(word: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !word.trim()) return false

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(word.trim())
  utterance.lang = 'en-US'
  utterance.rate = 0.86
  window.speechSynthesis.speak(utterance)
  return true
}
