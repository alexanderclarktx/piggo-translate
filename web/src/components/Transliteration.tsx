type TransliterationProps = {
  value: string
  isVisible: boolean
  onToggle: () => void
}

const Transliteration = ({ value, isVisible, onToggle }: TransliterationProps) => {
  return (
    <button
      type="button"
      className={`transliteration-box${isVisible ? "" : " is-collapsed"}`}
      aria-label={isVisible ? "Hide transliteration" : "Show transliteration"}
      aria-expanded={isVisible}
      onClick={onToggle}
      title={isVisible ? "Click to collapse transliteration" : "Click to expand transliteration"}
    >
      {isVisible ? (
        <p className="pane-footer transliteration-text">{value}</p>
      ) : (
        <span className="transliteration-collapsed-label"></span>
      )}
    </button>
  )
}

export { Transliteration }
