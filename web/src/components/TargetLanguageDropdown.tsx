import { useEffect, useRef, useState } from "react"
import { LanguageOption } from "./LanguagePicker"

type TargetLanguageDropdownProps = {
  options: LanguageOption[]
  targetLanguage: string
  onSelect: (language: string) => void
}

const TargetLanguageDropdown = ({ options, targetLanguage, onSelect }: TargetLanguageDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const eventTarget = event.target

      if (!(eventTarget instanceof Node)) return
      if (rootRef.current?.contains(eventTarget)) return

      setIsOpen(false)
    }

    document.addEventListener("pointerdown", onPointerDown)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [isOpen])

  return (
    <section ref={rootRef} className="input-pane-language-menu">
      <button
        type="button"
        className="input-pane-target-language fade-in"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((value) => !value)
        }}
      >
        {targetLanguage}
      </button>

      {isOpen ? (
        <div className="input-pane-target-language-dropdown" role="listbox" aria-label="Select target language">
          {options
            .filter((option) => option.value !== targetLanguage)
            .map((option) => {
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="input-pane-target-language-option"
                  data-selected="false"
                  onClick={() => {
                    onSelect(option.value)
                    setIsOpen(false)
                  }}
                >
                  {option.label}
                </button>
              )
            })}
        </div>
      ) : null}
    </section>
  )
}

export { TargetLanguageDropdown }
