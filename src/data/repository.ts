import { seedWords } from './seedWords'
import type { AutomaticVocabularyDraft, VocabularyDraft, VocabularyEntry } from '../types'

const STORAGE_KEY = 'cet6-vocabulary-notebook-v1'

const byWord = (entries: VocabularyEntry[]) =>
  [...entries].sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }))

function readStoredEntries(): VocabularyEntry[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as VocabularyEntry[]) : null
  } catch {
    return null
  }
}

function writeEntries(entries: VocabularyEntry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function createId(prefix = 'word') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cleaned(draft: VocabularyDraft): VocabularyDraft {
  return {
    word: draft.word.trim(),
    definition: draft.definition.trim(),
    category: draft.category,
    phonetic: draft.phonetic?.trim(),
    example: draft.example?.trim(),
    note: draft.note?.trim(),
  }
}

/**
 * 首版使用 localStorage，调用方仅依赖此接口。未来可替换为 Vercel API/数据库实现，无需改动界面。
 */
export const vocabularyRepository = {
  list(): VocabularyEntry[] {
    return byWord(readStoredEntries() ?? seedWords)
  },

  create(draft: VocabularyDraft): VocabularyEntry {
    const now = new Date().toISOString()
    const entry: VocabularyEntry = {
      id: createId(),
      ...cleaned(draft),
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    }
    writeEntries([...this.list(), entry])
    return entry
  },

  update(id: string, draft: VocabularyDraft): VocabularyEntry | undefined {
    let changed: VocabularyEntry | undefined
    const next = this.list().map((entry) => {
      if (entry.id !== id) return entry
      changed = { ...entry, ...cleaned(draft), updatedAt: new Date().toISOString() }
      return changed
    })
    writeEntries(next)
    return changed
  },

  remove(id: string) {
    writeEntries(this.list().filter((entry) => entry.id !== id))
  },

  /** 自动收录入口：后续接入 OCR、阅读材料或 API 时调用。 */
  upsertFromAutomation(draft: AutomaticVocabularyDraft): VocabularyEntry {
    const current = this.list()
    const existing = current.find((entry) => entry.word.toLowerCase() === draft.word.trim().toLowerCase())
    const now = new Date().toISOString()
    const entry: VocabularyEntry = {
      id: existing?.id ?? createId('auto'),
      ...cleaned(draft),
      source: 'automatic',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      note: [draft.note, draft.provider ? `自动收录：${draft.provider}` : undefined]
        .filter(Boolean)
        .join(' · '),
    }
    writeEntries([...current.filter((item) => item.id !== entry.id), entry])
    return entry
  },
}
