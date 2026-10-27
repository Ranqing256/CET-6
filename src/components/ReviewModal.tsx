import { useState } from 'react'
import { Check, RotateCcw, Volume2, X } from 'lucide-react'
import { CATEGORY_META, type ReviewRating, type VocabularyEntry } from '../types'
import { useDialogA11y } from '../utils/useDialogA11y'

interface ReviewModalProps {
  entries: VocabularyEntry[]
  onClose: () => void
  onRate: (id: string, rating: ReviewRating) => void
  onSpeak: (word: string) => void
}

export function ReviewModal({ entries, onClose, onRate, onSpeak }: ReviewModalProps) {
  const dialogRef = useDialogA11y(onClose)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [knownCount, setKnownCount] = useState(0)
  const [againCount, setAgainCount] = useState(0)
  const [ratedCount, setRatedCount] = useState(0)
  const current = entries[index]
  const meta = current ? CATEGORY_META[current.category] : undefined
  const progressPercent = entries.length ? Math.round((ratedCount / entries.length) * 100) : 100

  function rate(rating: ReviewRating) {
    if (!current) return
    onRate(current.id, rating)
    setRatedCount((count) => count + 1)
    if (rating === 'known') setKnownCount((count) => count + 1)
    else setAgainCount((count) => count + 1)
    setRevealed(false)
    if (index + 1 >= entries.length) setFinished(true)
    else setIndex((value) => value + 1)
  }

  return <div className="modal-backdrop review-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} tabIndex={-1} className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <header className="review-header">
        <div>
          <p className="eyebrow">SPACED REVIEW</p>
          <h2 id="review-title">今日复习</h2>
        </div>
        <div className="review-session-count">{finished ? entries.length : Math.min(index + 1, entries.length)} <span>/ {entries.length}</span></div>
        <button className="icon-button" onClick={onClose} aria-label="关闭复习"><X size={20} /></button>
      </header>
      <div className="review-progress-track" aria-label={`复习进度 ${progressPercent}%`}>
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      {finished ? <div className="review-finish">
        <div className="finish-mark"><Check size={26} /></div>
        <p className="eyebrow">SESSION COMPLETE</p>
        <h3>复习完成，继续保持。</h3>
        <p>认识 <b>{knownCount}</b> 个 · 再看 <b>{againCount}</b> 个</p>
        <p className="finish-note">不熟悉的词已安排在 10 分钟后再次出现。</p>
        <button className="button button-primary" onClick={onClose}>回到词库</button>
      </div> : !current ? <div className="review-finish">
        <div className="finish-mark"><Check size={26} /></div>
        <h3>暂时没有待复习的词。</h3>
        <p className="finish-note">录入新词后，它会出现在复习队列里。</p>
        <button className="button button-primary" onClick={onClose}>回到词库</button>
      </div> : <>
        <p className="review-prompt">先回想它的意思，再揭晓答案。</p>
        <article className="review-card">
          <span className="tag" style={{ color: meta?.accent, background: meta?.pale }}>{meta?.label}</span>
          <div className="review-word-line">
            <h3>{current.word}</h3>
            <button className="speech-button large" onClick={() => onSpeak(current.word)} aria-label={`播放 ${current.word} 的发音`} title="播放单词发音">
              <Volume2 size={19} />
            </button>
          </div>
          {current.phonetic && <p className="review-phonetic">{current.phonetic}</p>}
          {revealed ? <div className="review-answer">
            <p className="review-definition">{current.definition}</p>
            {current.example && <p className="review-example">“{current.example}”</p>}
            {current.note && <p className="review-note">笔记：{current.note}</p>}
            <div className="review-ratings">
              <button className="button button-again" onClick={() => rate('again')}><RotateCcw size={16} /> 再复习 <small>10 分钟后</small></button>
              <button className="button button-primary" onClick={() => rate('known')}><Check size={16} /> 认识</button>
            </div>
          </div> : <button className="button button-reveal" onClick={() => setRevealed(true)}>显示释义</button>}
        </article>
        <p className="review-footnote">认识的词按 1、3、7、14、30 天间隔复习。</p>
      </>}
    </section>
  </div>
}
