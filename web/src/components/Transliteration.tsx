type TransliterationProps = {
  isVisible: boolean
  onToggle: () => void
}

const Transliteration = ({ isVisible, onToggle }: TransliterationProps) => {
  return (
    <div className="transliteration-toggle-row">
      <button
        type="button"
        className="transliteration-toggle"
        aria-label={isVisible ? "Hide transliteration" : "Show transliteration"}
        aria-expanded={isVisible}
        onClick={onToggle}
      >
        <span
          className={`transliteration-caret${isVisible ? "" : " is-collapsed"}`}
          aria-hidden="true"
        >
          ^
        </span>
      </button>
    </div>
  )
}

export { Transliteration }
