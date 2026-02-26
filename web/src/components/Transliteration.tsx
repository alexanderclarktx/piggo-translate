import { useEffect, useRef, useState } from "react"

type TransliterationProps = {
  value: string
  isVisible: boolean
  onToggle: () => void
}

const Transliteration = ({ value, isVisible, onToggle }: TransliterationProps) => {
  const [text, setText] = useState(value)
  const [desiredText, setDesiredText] = useState(value)
  const desiredTextRef = useRef(value)
  const hasValue = Boolean(value)
  const isExpanded = hasValue && isVisible

  useEffect(() => {
    setDesiredText(value)
  }, [value])

  useEffect(() => {
    desiredTextRef.current = desiredText
  }, [desiredText])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setText((currentText) => {
        const nextDesiredText = desiredTextRef.current

        if (currentText === nextDesiredText) {
          return currentText
        }

        const desiredPrefix = nextDesiredText.slice(0, currentText.length)

        if (currentText !== desiredPrefix) {
          return currentText.slice(0, -1)
        }

        return nextDesiredText.slice(0, currentText.length + 1)
      })
    }, 50)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

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
    >
      <span className={`transliteration-collapsed-label${hasValue && !isExpanded ? " is-visible" : ""}`}/>

      <p className={`pane-footer transliteration-text transliteration-panel${isExpanded ? " is-visible" : ""}`}>
        {text}
      </p>
    </button>
  )
}

export { Transliteration }
