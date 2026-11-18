import type { VocabularyEntry } from '../types'

const ENRICHED_READING_WORDS = new Set([
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

/** Only the 32 reading entries added on 2026-11-18 receive the enriched display. */
export function isEnrichedReadingWord(entry: Pick<VocabularyEntry, 'word' | 'category'>): boolean {
  return entry.category === 'reading' && ENRICHED_READING_WORDS.has(entry.word.trim().toLocaleLowerCase())
}
