import type { VocabularyEntry } from '../types'
import { getEnrichedDefinitionLines } from '../utils/enrichedReadingDefinitions'

interface DefinitionDisplayProps {
  entry: VocabularyEntry
  className: string
}

export function DefinitionDisplay({ entry, className }: DefinitionDisplayProps) {
  const lines = getEnrichedDefinitionLines(entry)
  if (!lines) return <p className={className}>{entry.definition}</p>

  return <div className={`${className} pos-definition-list`} aria-label="词性与释义">
    {lines.map((line, index) => <p className="pos-definition-line" key={`${line.pos}-${index}`}>
      <span className="pos-definition-label">{line.pos}</span>
      <span className="pos-definition-text">{line.text}</span>
    </p>)}
  </div>
}
