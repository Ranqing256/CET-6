import type { VocabularyEntry } from '../types'
import { isEnrichedReadingWord } from '../data/enrichedReadingWords'

export type EnrichedNoteSectionKey = 'collocations' | 'extensions' | 'distinctions'

export interface EnrichedNoteSection {
  key: EnrichedNoteSectionKey
  label: string
  content: string
}

const SECTION_LABELS: Record<EnrichedNoteSectionKey, string> = {
  collocations: '搭配',
  extensions: '拓展',
  distinctions: '辨析',
}

/** Only the 32 reading entries added on 2026-11-18 have their original notes split into panels. */
export function getEnrichedNoteSections(entry: Pick<VocabularyEntry, 'word' | 'category' | 'note'>): EnrichedNoteSection[] | null {
  if (!isEnrichedReadingWord(entry)) return null
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
