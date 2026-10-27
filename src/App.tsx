import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  BookmarkPlus,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  GraduationCap,
  ListFilter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react'
import { vocabularyRepository } from './data/repository'
import { ReviewModal } from './components/ReviewModal'
import { CATEGORY_META, type Category, type ReviewProgress, type ReviewRating, type VocabularyDraft, type VocabularyEntry } from './types'
import { speakEnglishWord } from './utils/speech'
import { useDialogA11y } from './utils/useDialogA11y'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const categoryList = Object.keys(CATEGORY_META) as Category[]

type ActiveCategory = Category | 'all'
type EditorState = { entry?: VocabularyEntry } | null

function emptyDraft(category: Category = 'reading'): VocabularyDraft {
  return { word: '', definition: '', category, phonetic: '', example: '', note: '' }
}

function draftFromEntry(entry?: VocabularyEntry): VocabularyDraft {
  if (!entry) return emptyDraft()
  const { word, definition, category, phonetic = '', example = '', note = '' } = entry
  return { word, definition, category, phonetic, example, note }
}

function categoryEntries(category: Category, entries: VocabularyEntry[]) {
  return entries.filter((entry) => entry.category === category).length
}

export default function App() {
  const [entries, setEntries] = useState<VocabularyEntry[]>(() => vocabularyRepository.list())
  const [reviewProgress, setReviewProgress] = useState<Record<string, ReviewProgress>>(() => vocabularyRepository.getProgress())
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('all')
  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  const [showDueOnly, setShowDueOnly] = useState(false)
  const [editor, setEditor] = useState<EditorState>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewSessionEntries, setReviewSessionEntries] = useState<VocabularyEntry[]>([])
  const [draft, setDraft] = useState<VocabularyDraft>(() => emptyDraft())
  const [validation, setValidation] = useState('')
  const [notice, setNotice] = useState('')
  const importInput = useRef<HTMLInputElement>(null)

  const reviewSummary = useMemo(
    () => vocabularyRepository.reviewSummary(entries, reviewProgress),
    [entries, reviewProgress],
  )
  const dueEntries = useMemo(
    () => vocabularyRepository.listDueEntries(entries, reviewProgress),
    [entries, reviewProgress],
  )
  const dueIds = useMemo(() => new Set(dueEntries.map((entry) => entry.id)), [dueEntries])

  const filteredEntries = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return entries.filter((entry) => {
      const matchesCategory = activeCategory === 'all' || entry.category === activeCategory
      const matchesLetter = !activeLetter || entry.word.toUpperCase().startsWith(activeLetter)
      const matchesDue = !showDueOnly || dueIds.has(entry.id)
      const haystack = `${entry.word} ${entry.definition} ${entry.note ?? ''} ${entry.example ?? ''} ${entry.phonetic ?? ''}`.toLocaleLowerCase()
      return matchesCategory && matchesLetter && matchesDue && (!term || haystack.includes(term))
    })
  }, [activeCategory, activeLetter, dueIds, entries, query, showDueOnly])

  const manualCount = entries.filter((entry) => entry.source === 'manual').length
  const categoryCount = categoryList.filter((category) => categoryEntries(category, entries) > 0).length
  const todayProgress = entries.length ? Math.min(100, Math.round((reviewSummary.reviewedToday / entries.length) * 100)) : 0

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3600)
    return () => window.clearTimeout(timer)
  }, [notice])

  function openEditor(entry?: VocabularyEntry, preferredCategory?: Category) {
    setValidation('')
    setDraft(entry ? draftFromEntry(entry) : emptyDraft(preferredCategory ?? (activeCategory === 'all' ? 'reading' : activeCategory)))
    setEditor({ entry })
  }

  function closeEditor() {
    setEditor(null)
    setValidation('')
  }

  function refreshEntries() {
    setEntries(vocabularyRepository.list())
    setReviewProgress(vocabularyRepository.getProgress())
  }

  function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.word.trim() || !draft.definition.trim()) {
      setValidation('请填写英文单词和中文释义，再保存。')
      return
    }
    if (editor?.entry) vocabularyRepository.update(editor.entry.id, draft)
    else vocabularyRepository.create(draft)
    refreshEntries()
    closeEditor()
    setNotice(editor?.entry ? '词条已更新。' : '新词已加入词库，稍后记得复习。')
  }

  function deleteEntry(entry: VocabularyEntry) {
    if (!window.confirm(`确认删除“${entry.word}”吗？`)) return
    vocabularyRepository.remove(entry.id)
    refreshEntries()
    if (editor?.entry?.id === entry.id) closeEditor()
    setNotice(`已删除 ${entry.word}。`)
  }

  function updateDraft<K extends keyof VocabularyDraft>(key: K, value: VocabularyDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function startReview() {
    const dueNow = vocabularyRepository.listDueEntries(entries, reviewProgress)
    if (!dueNow.length) {
      setNotice('今天的待复习词已完成，真不错。')
      return
    }
    setReviewSessionEntries(dueNow)
    setReviewOpen(true)
  }

  function recordReview(id: string, rating: ReviewRating) {
    vocabularyRepository.markReviewed(id, rating)
    setReviewProgress(vocabularyRepository.getProgress())
  }

  function exportBackup() {
    const backup = vocabularyRepository.exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `CET6-vocab-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice(`已导出 ${backup.entries.length} 个词条及复习进度。`)
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const payload: unknown = JSON.parse(await file.text())
      const result = vocabularyRepository.importBackup(payload)
      refreshEntries()
      setNotice(`导入完成：新增 ${result.imported} 个，跳过重复词 ${result.skipped} 个。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '备份文件无法读取，请确认文件格式。')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="六级词汇本首页">
          <span className="brand-mark"><BookOpen size={19} strokeWidth={2.2} /></span>
          <span className="brand-copy"><b>六级词汇本</b><small>CET-6 VOCABULARY</small></span>
        </a>
        <div className="topbar-tools">
          <span className="save-note"><span className="status-dot" /> 本地已保存</span>
          <button className="button button-review" onClick={startReview} aria-label={`今日复习，${reviewSummary.due} 张待复习`}>
            <GraduationCap size={17} /> <span className="review-button-label">今日复习</span> <span className="button-count">{reviewSummary.due}</span>
          </button>
          <button className="button button-primary" onClick={() => openEditor()}>
            <Plus size={17} /> 录入生词
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-gridline" />
        <div className="hero-content">
          <p className="eyebrow">YOUR PERSONAL WORD BANK</p>
          <h1>把不会的词，<br /><em>变成会用的词。</em></h1>
          <p className="hero-description">录入、归类、检索，然后在每一次复习中重新遇见它们。</p>
          <div className="hero-stats" aria-label="词汇统计">
            <span><strong>{entries.length}</strong> 收录词汇</span>
            <span><strong>{manualCount}</strong> 手动录入</span>
            <span><strong>{categoryCount}</strong> 已覆盖题型</span>
          </div>
        </div>
        <div className="hero-card" aria-label="今日复习进度">
          <div className="hero-card-top"><span>今日复习</span><Sparkles size={15} /></div>
          <div className="review-summary-line"><strong>{reviewSummary.due}</strong><span>张待复习词卡</span></div>
          <div className="hero-progress-track"><span style={{ width: `${todayProgress}%` }} /></div>
          <div className="hero-review-meta"><span>已复习 {reviewSummary.reviewedToday} 张</span><span>{reviewSummary.mastered} 个已掌握</span></div>
          <button className="review-cta" onClick={startReview} disabled={reviewSummary.due === 0}>
            {reviewSummary.due ? '开始复习' : '今日已完成'} <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <div className="workspace">
        <aside className="sidebar">
          <div className="side-heading"><span>词汇索引</span><span className="side-total">{entries.length}</span></div>
          <nav className="category-nav" aria-label="词汇分类">
            <button className={activeCategory === 'all' ? 'category-item active' : 'category-item'} onClick={() => { setActiveCategory('all'); setActiveLetter(null) }}>
              <span className="category-icon all"><ListFilter size={15} /></span><span>全部词汇</span><b>{entries.length}</b>
            </button>
            {categoryList.map((category) => {
              const meta = CATEGORY_META[category]
              return <button key={category} className={activeCategory === category ? 'category-item active' : 'category-item'} onClick={() => { setActiveCategory(category); setActiveLetter(null) }}>
                <span className="category-icon" style={{ color: meta.accent, background: meta.pale }}>{meta.short}</span><span>{meta.label}</span><b>{categoryEntries(category, entries)}</b>
              </button>
            })}
          </nav>
          <div className="auto-note">
            <div className="auto-note-icon"><BookmarkPlus size={17} /></div>
            <div><b>自动收录，准备就绪</b><p>词库接口已预留，未来可接入阅读材料或 AI 自动整理。</p></div>
          </div>
          <div className="study-note">
            <span className="study-note-icon"><Check size={15} /></span>
            <p><b>小步复习</b><br />每天复习几张卡，比临考突击更牢。</p>
          </div>
        </aside>

        <section className="content-area" aria-label="词汇卡列表">
          <div className="content-heading">
            <div>
              <p className="eyebrow">VOCABULARY LIBRARY</p>
              <h2>{activeCategory === 'all' ? '全部词汇' : CATEGORY_META[activeCategory].label}</h2>
            </div>
            <div className="heading-actions">
              <button className={showDueOnly ? 'button button-filter active' : 'button button-filter'} onClick={() => setShowDueOnly((value) => !value)} aria-pressed={showDueOnly}>
                <RotateCcw size={15} /> 待复习 <span className="filter-count">{reviewSummary.due}</span>
              </button>
              <button className="button button-ghost mobile-add" onClick={() => openEditor()}><Plus size={17} /> 新词</button>
            </div>
          </div>

          <div className="search-row">
            <label className="search-box">
              <Search size={19} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索英文单词、释义或例句..." aria-label="搜索英文单词、释义或例句" />
              {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="清空搜索"><X size={16} /></button>}
            </label>
            <span className="result-count">显示 <b>{filteredEntries.length}</b> / {entries.length}</span>
          </div>

          <div className="backup-row">
            <p>词库保存在当前浏览器，建议定期备份。</p>
            <div className="backup-actions">
              <button className="button button-quiet" onClick={exportBackup} title="下载词条和复习进度"><Download size={15} /> 导出备份</button>
              <button className="button button-quiet" onClick={() => importInput.current?.click()} title="从六级词汇本 JSON 备份恢复"><Upload size={15} /> 导入备份</button>
              <input ref={importInput} className="hidden-file-input" type="file" accept=".json,application/json" onChange={importBackup} aria-label="选择 JSON 备份文件" />
            </div>
          </div>

          <div className="alphabet-index" aria-label="按首字母筛选">
            <span>索引</span>
            <div>
              {alphabet.map((letter) => {
                const available = entries.some((entry) => entry.word.toUpperCase().startsWith(letter))
                return <button key={letter} disabled={!available} className={activeLetter === letter ? 'letter active' : 'letter'} onClick={() => setActiveLetter((current) => current === letter ? null : letter)}>{letter}</button>
              })}
            </div>
            {activeLetter && <button className="reset-index" onClick={() => setActiveLetter(null)}>清除</button>}
          </div>

          {filteredEntries.length > 0 ? <div className="word-grid">
            {filteredEntries.map((entry) => <WordCard key={entry.id} entry={entry} onEdit={() => openEditor(entry)} onDelete={() => deleteEntry(entry)} />)}
          </div> : <div className="empty-state">
            <div className="empty-icon"><Search size={25} /></div>
            <h3>{showDueOnly && !reviewSummary.due ? '今天没有待复习的词' : '没有找到匹配的词汇'}</h3>
            <p>{showDueOnly && !reviewSummary.due ? '间隔复习会在词条到期时提醒你回来。' : '换个关键词，或清除当前的索引与分类条件。'}</p>
            <button className="button button-ghost" onClick={() => { setQuery(''); setActiveLetter(null); setActiveCategory('all'); setShowDueOnly(false) }}>重置筛选</button>
          </div>}
        </section>
      </div>

      <footer><span>六级词汇本</span><span>为每一个不认识的词，留下一张卡。词库保存在此浏览器，请记得导出备份。</span></footer>
      {notice && <div className="notice-toast" role="status" aria-live="polite">{notice}</div>}

      {editor && <EditorModal
        entry={editor.entry}
        draft={draft}
        validation={validation}
        onChange={updateDraft}
        onClose={closeEditor}
        onSubmit={submitEntry}
        onDelete={editor.entry ? () => deleteEntry(editor.entry!) : undefined}
      />}
      {reviewOpen && <ReviewModal
        entries={reviewSessionEntries}
        onRate={recordReview}
        onClose={() => { setReviewOpen(false); setReviewSessionEntries([]) }}
      />}
    </main>
  )
}

function WordCard({ entry, onEdit, onDelete }: { entry: VocabularyEntry; onEdit: () => void; onDelete: () => void }) {
  const meta = CATEGORY_META[entry.category]
  return <article className="word-card" style={{ '--card-accent': meta.accent } as React.CSSProperties}>
    <div className="card-topline">
      <span className="tag" style={{ color: meta.accent, background: meta.pale }}>{meta.label}</span>
      <span className={entry.source === 'manual' ? 'source-badge manual' : 'source-badge'}>{entry.source === 'manual' ? '手动' : entry.source === 'automatic' ? '自动' : '示例'}</span>
    </div>
    <div className="word-main">
      <h3>{entry.word}</h3>
      <button className="speech-button" onClick={() => speakEnglishWord(entry.word)} aria-label={`播放 ${entry.word} 的发音`} title="播放单词发音"><Volume2 size={15} /></button>
      {entry.phonetic && <span className="phonetic">{entry.phonetic}</span>}
    </div>
    <p className="definition">{entry.definition}</p>
    <div className="card-rule" />
    {entry.example ? <p className="example">“{entry.example}”</p> : <p className="example muted">添加例句，让记忆更牢固。</p>}
    <div className="card-actions">
      <button onClick={onEdit}><Pencil size={14} /> 编辑</button>
      <button className="delete-button" onClick={onDelete} aria-label={`删除 ${entry.word}`}><Trash2 size={14} /></button>
    </div>
  </article>
}

function EditorModal({
  entry,
  draft,
  validation,
  onChange,
  onClose,
  onSubmit,
  onDelete,
}: {
  entry?: VocabularyEntry
  draft: VocabularyDraft
  validation: string
  onChange: <K extends keyof VocabularyDraft>(key: K, value: VocabularyDraft[K]) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDelete?: () => void
}) {
  const dialogRef = useDialogA11y(onClose)
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} tabIndex={-1} className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <header className="modal-header">
        <div><p className="eyebrow">{entry ? 'UPDATE ENTRY' : 'NEW VOCABULARY'}</p><h2 id="editor-title">{entry ? '编辑词条' : '录入生词'}</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={21} /></button>
      </header>
      <form onSubmit={onSubmit}>
        <div className="form-grid primary-fields">
          <label>英文单词 <span>*</span><input autoFocus value={draft.word} onChange={(event) => onChange('word', event.target.value)} placeholder="例如: compelling" /></label>
          <label>所属类别 <span>*</span><select value={draft.category} onChange={(event) => onChange('category', event.target.value as Category)}>{categoryList.map((category) => <option value={category} key={category}>{CATEGORY_META[category].label}</option>)}</select></label>
        </div>
        <label>中文释义 <span>*</span><input value={draft.definition} onChange={(event) => onChange('definition', event.target.value)} placeholder="例如: adj. 令人信服的；引人入胜的" /></label>
        <div className="form-grid">
          <label>音标 <input value={draft.phonetic} onChange={(event) => onChange('phonetic', event.target.value)} placeholder="/kəmˈpelɪŋ/" /></label>
          <label>我的笔记 <input value={draft.note} onChange={(event) => onChange('note', event.target.value)} placeholder="易混词、搭配等" /></label>
        </div>
        <label>例句 <textarea value={draft.example} onChange={(event) => onChange('example', event.target.value)} placeholder="写下一句你想记住的用法…" rows={3} /></label>
        {validation && <p className="form-error"><CircleHelp size={15} /> {validation}</p>}
        <div className="modal-actions">
          {onDelete && <button type="button" className="delete-text-button" onClick={onDelete}><Trash2 size={16} /> 删除词条</button>}
          <div className="right-actions"><button type="button" className="button button-ghost" onClick={onClose}>取消</button><button type="submit" className="button button-primary">{entry ? '保存修改' : '保存词卡'}</button></div>
        </div>
      </form>
    </section>
  </div>
}
