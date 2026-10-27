export const CATEGORY_META = {
  listening: { label: '听力', short: '听', accent: '#2563eb', pale: '#dbeafe' },
  cloze: { label: '完形填空', short: '完', accent: '#7c3aed', pale: '#ede9fe' },
  reading: { label: '阅读', short: '阅', accent: '#0891b2', pale: '#cffafe' },
  translation: { label: '翻译', short: '译', accent: '#d97706', pale: '#fef3c7' },
  writing: { label: '作文', short: '作', accent: '#db2777', pale: '#fce7f3' },
} as const

export type Category = keyof typeof CATEGORY_META
export type VocabSource = 'manual' | 'sample' | 'automatic'
export type ReviewRating = 'again' | 'known'

export interface VocabularyEntry {
  id: string
  word: string
  definition: string
  category: Category
  phonetic?: string
  example?: string
  note?: string
  source: VocabSource
  createdAt: string
  updatedAt: string
}

export interface VocabularyDraft {
  word: string
  definition: string
  category: Category
  phonetic?: string
  example?: string
  note?: string
}

export interface ReviewProgress {
  dueAt: string
  lastReviewedAt: string
  intervalDays: number
  reviewCount: number
  streak: number
}

export interface ReviewSummary {
  due: number
  reviewedToday: number
  mastered: number
}

export interface VocabularyBackup {
  format: 'cet6-vocabulary-notebook'
  version: 1
  exportedAt: string
  entries: VocabularyEntry[]
  progress: Record<string, ReviewProgress>
}

/**
 * 未来的自动收录服务可将解析后的词条传入此接口；UI 录入和自动入库共享同一套词库模型。
 */
export interface AutomaticVocabularyDraft extends VocabularyDraft {
  externalId: string
  provider?: string
}
