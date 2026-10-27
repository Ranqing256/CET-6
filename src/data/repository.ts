import { CATEGORY_META, type AutomaticVocabularyDraft, type Category, type ReviewProgress, type ReviewRating, type ReviewSummary, type VocabularyBackup, type VocabularyDraft, type VocabularyEntry } from '../types'
import { seedWords } from './seedWords'

const STORAGE_KEY = 'cet6-vocabulary-notebook-v2'
const LEGACY_ENTRIES_KEY = 'cet6-vocabulary-notebook-v1'
const LEGACY_PROGRESS_KEY = 'cet6-vocabulary-review-v1'
const KNOWN_INTERVALS_DAYS = [1, 3, 7, 14, 30]
const AGAIN_DELAY_MS = 10 * 60 * 1000

interface StoredNotebook {
  version: 2
  entries: VocabularyEntry[]
  progress: Record<string, ReviewProgress>
}

const byWord = (entries: VocabularyEntry[]) =>
  [...entries].sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_META, value)
}

function isProgress(value: unknown): value is ReviewProgress {
  if (!isRecord(value)) return false
  return isValidDate(value.dueAt)
    && isValidDate(value.lastReviewedAt)
    && typeof value.intervalDays === 'number'
    && [0, ...KNOWN_INTERVALS_DAYS].includes(value.intervalDays)
    && typeof value.reviewCount === 'number'
    && Number.isInteger(value.reviewCount)
    && value.reviewCount >= 1
    && typeof value.streak === 'number'
    && Number.isInteger(value.streak)
    && value.streak >= 0
    && value.streak <= value.reviewCount
}

function readStoredNotebook(): StoredNotebook | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 2 || !Array.isArray(parsed.entries) || !isRecord(parsed.progress)) return null
    const progress = Object.fromEntries(Object.entries(parsed.progress).filter(([, value]) => isProgress(value))) as Record<string, ReviewProgress>
    return { version: 2, entries: parsed.entries as VocabularyEntry[], progress }
  } catch {
    return null
  }
}

function readStoredEntries(): VocabularyEntry[] | null {
  const notebook = readStoredNotebook()
  if (notebook) return notebook.entries
  try {
    const raw = window.localStorage.getItem(LEGACY_ENTRIES_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as VocabularyEntry[]) : null
  } catch {
    return null
  }
}

function readStoredProgress(): Record<string, ReviewProgress> {
  const notebook = readStoredNotebook()
  if (notebook) return notebook.progress
  try {
    const raw = window.localStorage.getItem(LEGACY_PROGRESS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isProgress(value))) as Record<string, ReviewProgress>
  } catch {
    return {}
  }
}

function writeNotebook(entries: VocabularyEntry[], progress: Record<string, ReviewProgress>) {
  const notebook: StoredNotebook = { version: 2, entries, progress }
  // One localStorage write keeps an import atomic: either both vocab and progress land, or neither does.
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook))
  try {
    window.localStorage.removeItem(LEGACY_ENTRIES_KEY)
    window.localStorage.removeItem(LEGACY_PROGRESS_KEY)
  } catch {
    // The new notebook is already committed; stale legacy keys are harmless fallbacks.
  }
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

function isVocabSource(value: unknown): value is VocabularyEntry['source'] {
  return value === 'manual' || value === 'sample' || value === 'automatic'
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
    writeNotebook([...this.list(), entry], this.getProgress())
    return entry
  },

  update(id: string, draft: VocabularyDraft): VocabularyEntry | undefined {
    let changed: VocabularyEntry | undefined
    const next = this.list().map((entry) => {
      if (entry.id !== id) return entry
      changed = { ...entry, ...cleaned(draft), updatedAt: new Date().toISOString() }
      return changed
    })
    writeNotebook(next, this.getProgress())
    return changed
  },

  remove(id: string) {
    const progress = this.getProgress()
    delete progress[id]
    writeNotebook(this.list().filter((entry) => entry.id !== id), progress)
  },

  getProgress(): Record<string, ReviewProgress> {
    return readStoredProgress()
  },

  listDueEntries(entries: VocabularyEntry[] = byWord(readStoredEntries() ?? seedWords), progress = readStoredProgress(), now = Date.now()): VocabularyEntry[] {
    return entries.filter((entry) => {
      const record = progress[entry.id]
      return !record || Date.parse(record.dueAt) <= now
    })
  },

  reviewSummary(entries: VocabularyEntry[] = byWord(readStoredEntries() ?? seedWords), progress = readStoredProgress(), now = new Date()): ReviewSummary {
    const today = now.toDateString()
    const records = entries.map((entry) => progress[entry.id]).filter((record): record is ReviewProgress => Boolean(record))
    return {
      due: this.listDueEntries(entries, progress, now.getTime()).length,
      reviewedToday: records.filter((record) => new Date(record.lastReviewedAt).toDateString() === today).length,
      mastered: records.filter((record) => record.intervalDays >= 7).length,
    }
  },

  markReviewed(id: string, rating: ReviewRating): ReviewProgress | undefined {
    const entries = this.list()
    if (!entries.some((entry) => entry.id === id)) return undefined
    const progress = this.getProgress()
    const previous = progress[id]
    const now = new Date()
    let intervalDays = 0
    let dueAt: Date

    if (rating === 'again') {
      dueAt = new Date(now.getTime() + AGAIN_DELAY_MS)
    } else {
      const previousIndex = KNOWN_INTERVALS_DAYS.indexOf(previous?.intervalDays ?? 0)
      const nextIndex = Math.min(previousIndex + 1, KNOWN_INTERVALS_DAYS.length - 1)
      intervalDays = KNOWN_INTERVALS_DAYS[nextIndex]
      dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000)
    }

    const record: ReviewProgress = {
      dueAt: dueAt.toISOString(),
      lastReviewedAt: now.toISOString(),
      intervalDays,
      reviewCount: (previous?.reviewCount ?? 0) + 1,
      streak: rating === 'again' ? 0 : (previous?.streak ?? 0) + 1,
    }
    progress[id] = record
    writeNotebook(entries, progress)
    return record
  },

  exportBackup(): VocabularyBackup {
    return {
      format: 'cet6-vocabulary-notebook',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: this.list(),
      progress: this.getProgress(),
    }
  },

  importBackup(payload: unknown): { imported: number; skipped: number } {
    if (!isRecord(payload)
      || payload.format !== 'cet6-vocabulary-notebook'
      || payload.version !== 1
      || !Array.isArray(payload.entries)
      || !isRecord(payload.progress)
      || Object.values(payload.progress).some((value) => !isProgress(value))) {
      throw new Error('文件格式不正确或复习进度损坏，请选择完整的六级词汇本 JSON 备份。')
    }

    const existing = this.list()
    const existingWords = new Set(existing.map((entry) => entry.word.trim().toLocaleLowerCase()))
    const existingByWord = new Map(existing.map((entry) => [entry.word.trim().toLocaleLowerCase(), entry]))
    const nextProgress = this.getProgress()
    const sourceProgress = payload.progress as Record<string, ReviewProgress>
    const importedEntries: VocabularyEntry[] = []
    let skipped = 0

    for (const [index, raw] of payload.entries.entries()) {
      if (!isRecord(raw)
        || typeof raw.word !== 'string'
        || !raw.word.trim()
        || typeof raw.definition !== 'string'
        || !raw.definition.trim()
        || !isCategory(raw.category)) {
        throw new Error(`备份中的第 ${index + 1} 条词目不完整，未导入任何数据。`)
      }

      const word = raw.word.trim()
      const normalizedWord = word.toLocaleLowerCase()
      if (existingWords.has(normalizedWord)) {
        skipped += 1
        const oldId = typeof raw.id === 'string' ? raw.id : ''
        const target = existingByWord.get(normalizedWord)
        const savedProgress = oldId ? sourceProgress[oldId] : undefined
        if (target && savedProgress && !nextProgress[target.id]) nextProgress[target.id] = savedProgress
        continue
      }

      const now = new Date().toISOString()
      const oldId = typeof raw.id === 'string' ? raw.id : ''
      const entry: VocabularyEntry = {
        id: createId('import'),
        word,
        definition: raw.definition.trim(),
        category: raw.category,
        phonetic: typeof raw.phonetic === 'string' ? raw.phonetic.trim() : undefined,
        example: typeof raw.example === 'string' ? raw.example.trim() : undefined,
        note: typeof raw.note === 'string' ? raw.note.trim() : undefined,
        source: isVocabSource(raw.source) ? raw.source : 'manual',
        createdAt: isValidDate(raw.createdAt) ? raw.createdAt : now,
        updatedAt: now,
      }
      importedEntries.push(entry)
      existingWords.add(normalizedWord)
      existingByWord.set(normalizedWord, entry)
      const savedProgress = oldId ? sourceProgress[oldId] : undefined
      if (savedProgress) nextProgress[entry.id] = savedProgress
    }

    writeNotebook(byWord([...existing, ...importedEntries]), nextProgress)
    return { imported: importedEntries.length, skipped }
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
    writeNotebook([...current.filter((item) => item.id !== entry.id), entry], this.getProgress())
    return entry
  },
}
