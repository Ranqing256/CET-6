import { type FormEvent, useMemo, useState } from 'react'
import {
  BookOpen,
  BookmarkPlus,
  ChevronRight,
  CircleHelp,
  ListFilter,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { vocabularyRepository } from './data/repository'
import { CATEGORY_META, type Category, type VocabularyDraft, type VocabularyEntry } from './types'

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
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('all')
  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)
  const [draft, setDraft] = useState<VocabularyDraft>(() => emptyDraft())
  const [validation, setValidation] = useState('')

  const filteredEntries = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return entries.filter((entry) => {
      const matchesCategory = activeCategory === 'all' || entry.category === activeCategory
      const matchesLetter = !activeLetter || entry.word.toUpperCase().startsWith(activeLetter)
      const haystack = `${entry.word} ${entry.definition} ${entry.note ?? ''}`.toLocaleLowerCase()
      return matchesCategory && matchesLetter && (!term || haystack.includes(term))
    })
  }, [activeCategory, activeLetter, entries, query])

  const featured = filteredEntries[0] ?? entries[0]
  const manualCount = entries.filter((entry) => entry.source === 'manual').length

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
  }

  function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.word.trim() || !draft.definition.trim()) {
      setValidation('请填写英文单词和中文释义，再保存。')
      return
    }
    if (editor?.entry) {
      vocabularyRepository.update(editor.entry.id, draft)
    } else {
      vocabularyRepository.create(draft)
    }
    refreshEntries()
    closeEditor()
  }

  function deleteEntry(entry: VocabularyEntry) {
    if (!window.confirm(`确认删除“${entry.word}”吗？`)) return
    vocabularyRepository.remove(entry.id)
    refreshEntries()
    if (editor?.entry?.id === entry.id) closeEditor()
  }

  function updateDraft<K extends keyof VocabularyDraft>(key: K, value: VocabularyDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
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
            <span><strong>{categoryList.filter((category) => categoryEntries(category, entries) > 0).length}</strong> 已覆盖题型</span>
          </div>
        </div>
        <div className="hero-card" aria-label="本次复习推荐">
          <div className="hero-card-top"><span>本次复习</span><Sparkles size={15} /></div>
          {featured ? <>
            <p className="hero-word">{featured.word}</p>
            <p className="hero-definition">{featured.definition}</p>
            <button className="text-button" onClick={() => openEditor(featured)}>查看词卡 <ChevronRight size={15} /></button>
          </> : <p className="hero-definition">先录入第一张词卡，开始积累吧。</p>}
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
        </aside>

        <section className="content-area" aria-label="词汇卡列表">
          <div className="content-heading">
            <div>
              <p className="eyebrow">VOCABULARY LIBRARY</p>
              <h2>{activeCategory === 'all' ? '全部词汇' : CATEGORY_META[activeCategory].label}</h2>
            </div>
            <button className="button button-ghost mobile-add" onClick={() => openEditor()}><Plus size={17} /> 新词</button>
          </div>

          <div className="search-row">
            <label className="search-box">
              <Search size={19} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索英文单词或中文释义..." aria-label="搜索英文单词或中文释义" />
              {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="清空搜索"><X size={16} /></button>}
            </label>
            <span className="result-count">显示 <b>{filteredEntries.length}</b> / {entries.length}</span>
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
            <h3>没有找到匹配的词汇</h3>
            <p>换个关键词，或清除当前的索引与分类条件。</p>
            <button className="button button-ghost" onClick={() => { setQuery(''); setActiveLetter(null); setActiveCategory('all') }}>重置筛选</button>
          </div>}
        </section>
      </div>

      <footer><span>六级词汇本</span><span>为每一个不认识的词，留下一张卡。</span></footer>

      {editor && <EditorModal
        entry={editor.entry}
        draft={draft}
        validation={validation}
        onChange={updateDraft}
        onClose={closeEditor}
        onSubmit={submitEntry}
        onDelete={editor.entry ? () => deleteEntry(editor.entry!) : undefined}
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
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
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
