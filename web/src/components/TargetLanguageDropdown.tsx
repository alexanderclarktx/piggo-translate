import { isMobile } from "@template/web"
import { Language } from "@template/core"
import { useState } from "react"

type Props = {
  options: Language[]
  targetLanguage: string
  onSelect: (language: string) => void
}

export const TargetLanguageDropdown = ({ options, targetLanguage, onSelect }: Props) => {
  const selectedLanguageLabel = options.find((option) => option.value === targetLanguage)?.label || targetLanguage
  const unselectedOptions = options.filter((option) => option.value !== targetLanguage)

  const [isDismissed, setIsDismissed] = useState(true)

  return (
    <section
      className={`input-pane-language-menu${isDismissed ? " input-pane-language-menu-dismissed" : ""}`}
      aria-label="Target language selector"
      onPointerLeave={(x) => {
        if (isMobile()) return
        setIsDismissed(true)
      }}
    >
      <button
        type="button"
        className="input-pane-target-language fade-in"
        onPointerEnter={() => {
          if (isMobile()) return
          setIsDismissed(false)
        }}
        onPointerDown={() => {
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
              onPointerDown={() => {
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
