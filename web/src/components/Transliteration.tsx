type TransliterationProps = {
  value: string
  isVisible: boolean
  onToggle: () => void
}

const Transliteration = ({ value, isVisible, onToggle }: TransliterationProps) => {
  const hasValue = Boolean(value)
  const isExpanded = hasValue && isVisible

  return (
    <button
      type="button"
      className={`transliteration-box${isExpanded ? "" : " is-collapsed"}${hasValue ? " has-value" : ""}`}
      aria-label={
        !hasValue
          ? "No transliteration available"
          : isExpanded
            ? "Hide transliteration"
            : "Show transliteration"
      }
      aria-expanded={isExpanded}
      aria-hidden={!hasValue}
      disabled={!hasValue}
      onClick={onToggle}
      title={
        !hasValue
          ? "No transliteration available"
          : isExpanded
            ? "Click to collapse transliteration"
            : "Click to expand transliteration"
      }
    >
      <span className={`transliteration-collapsed-label${hasValue && !isExpanded ? " is-visible" : ""}`}/>

      <p className={`pane-footer transliteration-text transliteration-panel${isExpanded ? " is-visible" : ""}`}>
        {value}
      </p>
    </button>
  )
}

export { Transliteration }
