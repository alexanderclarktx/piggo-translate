import { isMobile } from "@template/web"
import { LanguageOption } from ".."
import { useState } from "react"

type TargetLanguageDropdownProps = {
  options: LanguageOption[]
  targetLanguage: string
  onSelect: (language: string) => void
}

const TargetLanguageDropdown = ({ options, targetLanguage, onSelect }: TargetLanguageDropdownProps) => {
  const selectedLanguageLabel = options.find((option) => option.value === targetLanguage)?.label || targetLanguage
  const unselectedOptions = options.filter((option) => option.value !== targetLanguage)

  const [isDismissed, setIsDismissed] = useState(false)

  return (
    <section
      className={`input-pane-language-menu${isDismissed ? " input-pane-language-menu-dismissed" : ""}`}
      aria-label="Target language selector"
      onMouseLeave={() => {
        setIsDismissed(true)
      }}
    >
      <button
        type="button"
        className="input-pane-target-language fade-in"
        onMouseEnter={() => {
          if (isMobile()) return
          console.log("focused")
          setIsDismissed(false)
        }}
        onMouseDown={() => {
          setIsDismissed(!isDismissed)
        }}
      >
        {selectedLanguageLabel}
      </button>

      <div className="input-pane-target-language-dropdown" role="listbox" aria-label="Select target language">
        {unselectedOptions.map((option) => {
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={false}
              className="input-pane-target-language-option"
              data-selected="false"
              onClick={() => {
                setIsDismissed(true)
                onSelect(option.value)
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export { TargetLanguageDropdown }
