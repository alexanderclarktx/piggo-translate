type LanguageOption = {
  label: string
  value: string
}

type LanguagePickerProps = {
  options: LanguageOption[]
  targetLanguage: string
  onSelect: (language: string) => void
}

const LanguagePicker = ({ options, targetLanguage, onSelect }: LanguagePickerProps) => {
  return (
    <div className="language-picker" role="group" aria-label="Target language">
      <div className="language-bubbles">
        {options.map((option) => {
          const isSelected = option.value === targetLanguage

          return (
            <button
              key={option.label}
              className="language-bubble"
              data-selected={isSelected ? "true" : "false"}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                if (isSelected) return
                onSelect(option.value)
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export type { LanguageOption }
export { LanguagePicker }
