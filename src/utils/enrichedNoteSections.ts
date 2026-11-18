import type { VocabularyEntry } from '../types'

export type EnrichedNoteSectionKey = 'collocations' | 'extensions' | 'distinctions'

export interface EnrichedNoteSection {
  key: EnrichedNoteSectionKey
  label: string
  content: string
}

const TARGET_READING_WORDS = new Set([
  'by means of',
  'deed',
  'commemorate',
  'descend',
  'to date',
  'petition',
  'archive',
  'auction',
  'anonymous',
  'oak',
  'take shelter',
  'invent',
  'plantation',
  'irrefutable',
  'intervene',
  'unfold',
  'idly',
  'diffusion',
  'evade',
  'frontline',
  'precedent',
  'alleviate',
  'hazard',
  'slack',
  'strand',
  'coal',
  'neutrality',
  'phase out',
  'phase in',
  'grid',
  'lagging',
  'adherence',
])

const SECTION_LABELS: Record<EnrichedNoteSectionKey, string> = {
  collocations: '搭配',
  extensions: '拓展',
  distinctions: '辨析',
}

/**
 * 只为 2026-11-18 批量录入的 32 个阅读词拆分旧笔记；其他词条继续按原样显示。
 */
export function getEnrichedNoteSections(entry: Pick<VocabularyEntry, 'word' | 'category' | 'note'>): EnrichedNoteSection[] | null {
  if (entry.category !== 'reading' || !TARGET_READING_WORDS.has(entry.word.trim().toLocaleLowerCase())) return null
  const note = entry.note?.trim()
  if (!note) return null

  const markerPattern = /(搭配|拓展|扩展|辨析)\s*[:：]/g
  const markers: Array<{ label: string; index: number; contentStart: number }> = []
  let match: RegExpExecArray | null
  while ((match = markerPattern.exec(note)) !== null) {
    markers.push({ label: match[1], index: match.index, contentStart: markerPattern.lastIndex })
  }
  if (markers.length === 0) return null

  const contents = new Map<EnrichedNoteSectionKey, string[]>()
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index]
    const nextMarker = markers[index + 1]
    const content = note.slice(marker.contentStart, nextMarker?.index ?? note.length)
      .replace(/^[\s,，;；:：·]+/, '')
      .replace(/[\s,，;；]+$/, '')
      .trim()
    if (!content) continue

    const key: EnrichedNoteSectionKey = marker.label === '搭配'
      ? 'collocations'
      : marker.label === '辨析' ? 'distinctions' : 'extensions'
    const previous = contents.get(key) ?? []
    previous.push(content)
    contents.set(key, previous)
  }

  const sections = (Object.keys(SECTION_LABELS) as EnrichedNoteSectionKey[])
    .flatMap((key) => {
      const content = contents.get(key)?.join('；')
      return content ? [{ key, label: SECTION_LABELS[key], content }] : []
    })

  return sections.length ? sections : null
}
