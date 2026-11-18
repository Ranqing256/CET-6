import type { VocabularyEntry } from '../types'
import { isEnrichedReadingWord } from '../data/enrichedReadingWords'

export interface EnrichedDefinitionLine {
  pos: string
  text: string
}

const POS_MARKER_PATTERN = /(^|[\s;；,，、])((?:副词性词组|介词短语|动词短语|形容词短语|名词短语|短语动词|名词|动词|形容词|副词|介词|代词|连词|助动词|感叹词|数词|限定词|phr\.\s*v\.|modal\s+v\.|adj\.|adv\.|prep\.|pron\.|conj\.|aux\.|interj\.|num\.|det\.|n\.|v\.|vt\.|vi\.))\s*(（[^）]*）|\([^)]*\)|\[[^\]]+\])?\s*[:：]?\s*/gi

const POS_ABBREVIATIONS: Record<string, string> = {
  '副词性词组': 'adv. phr.',
  '介词短语': 'prep. phr.',
  '动词短语': 'v. phr.',
  '形容词短语': 'adj. phr.',
  '名词短语': 'n. phr.',
  '短语动词': 'phr. v.',
  'phr. v.': 'phr. v.',
  'modal v.': 'v.',
  '名词': 'n.',
  '动词': 'v.',
  '形容词': 'adj.',
  '副词': 'adv.',
  '介词': 'prep.',
  '代词': 'pron.',
  '连词': 'conj.',
  '助动词': 'aux.',
  '感叹词': 'interj.',
  '数词': 'num.',
  '限定词': 'det.',
  'n.': 'n.',
  'v.': 'v.',
  'vt.': 'v.',
  'vi.': 'v.',
  'adj.': 'adj.',
  'adv.': 'adv.',
  'prep.': 'prep.',
  'pron.': 'pron.',
  'conj.': 'conj.',
  'aux.': 'aux.',
  'interj.': 'interj.',
  'num.': 'num.',
  'det.': 'det.',
}

const FALLBACK_POS: Record<string, string> = {
  adherence: 'n.',
}

/**
 * Format only the 2026-11-18 reading batch. The stored definition remains untouched.
 */
export function getEnrichedDefinitionLines(
  entry: Pick<VocabularyEntry, 'word' | 'category' | 'definition'>,
): EnrichedDefinitionLine[] | null {
  if (!isEnrichedReadingWord(entry)) return null
  const definition = entry.definition.trim()
  if (!definition) return null

  const markers: Array<{ markerStart: number; contentStart: number; label: string; qualifier?: string }> = []
  let match: RegExpExecArray | null
  POS_MARKER_PATTERN.lastIndex = 0
  while ((match = POS_MARKER_PATTERN.exec(definition)) !== null) {
    const rawLabel = match[2].trim().replace(/\s+/g, ' ').toLocaleLowerCase()
    const label = POS_ABBREVIATIONS[rawLabel]
    if (!label) continue
    markers.push({
      markerStart: match.index + match[1].length,
      contentStart: POS_MARKER_PATTERN.lastIndex,
      label,
      qualifier: match[3]?.trim(),
    })
  }

  if (markers.length === 0) {
    const fallback = FALLBACK_POS[entry.word.trim().toLocaleLowerCase()]
    return fallback ? [{ pos: fallback, text: definition }] : null
  }

  const lines = markers.flatMap((marker, index) => {
    const nextMarker = markers[index + 1]
    const text = definition.slice(marker.contentStart, nextMarker?.markerStart ?? definition.length)
      .replace(/^[\s:：;；,，、]+/, '')
      .replace(/[\s,，;；、]+$/, '')
      .trim()
    if (!text) return []
    return [{ pos: marker.qualifier ? `${marker.label} ${marker.qualifier}` : marker.label, text }]
  })

  return lines.length ? lines : null
}
