import { useEffect, useState } from "react"

const transliterationAnimationMinIntervalMs = 15
const transliterationAnimationMaxIntervalMs = 55
const transliterationAnimationFastThreshold = 28

const getSharedPrefixLength = (left: string, right: string) => {
  const maxLength = Math.min(left.length, right.length)
  let index = 0

  while (index < maxLength && left[index] === right[index]) {
    index += 1
  }

  return index
}

const getAnimationWorkLeft = (currentText: string, desiredText: string) => {
  const sharedPrefixLength = getSharedPrefixLength(currentText, desiredText)
  const deleteSteps = currentText.length - sharedPrefixLength
  const addSteps = desiredText.length - sharedPrefixLength

  return deleteSteps + addSteps
}

const getDynamicIntervalDuration = (currentText: string, desiredText: string) => {
  const workLeft = getAnimationWorkLeft(currentText, desiredText)

  if (workLeft <= 1) {
    return transliterationAnimationMaxIntervalMs
  }

  const clampedProgress = Math.min((workLeft - 1) / (transliterationAnimationFastThreshold - 1), 1)
  const intervalRange = transliterationAnimationMaxIntervalMs - transliterationAnimationMinIntervalMs

  return Math.round(transliterationAnimationMaxIntervalMs - (intervalRange * clampedProgress))
}

type TransliterationProps = {
  value: string
  isVisible: boolean
  onToggle: () => void
}

const Transliteration = ({ value, isVisible, onToggle }: TransliterationProps) => {
  const [text, setText] = useState(value)
  const [desiredText, setDesiredText] = useState(value)
  const hasValue = Boolean(value)
  const isExpanded = hasValue && isVisible

  useEffect(() => {
    setDesiredText(value)
  }, [value])

  useEffect(() => {
    if (!desiredText) {
      setText("")
    }
  }, [desiredText])

  useEffect(() => {
    if (text === desiredText) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setText((currentText) => {
        const nextDesiredText = desiredText

        if (currentText === nextDesiredText) {
          return currentText
        }

        const desiredPrefix = nextDesiredText.slice(0, currentText.length)

        if (currentText !== desiredPrefix) {
          return currentText.slice(0, -1)
        }

        return nextDesiredText.slice(0, currentText.length + 1)
      })
    }, getDynamicIntervalDuration(text, desiredText))

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [desiredText, text])

  return (
    <button
      type="button"
      className={`transliteration-box${isExpanded ? "" : " is-collapsed"}${hasValue ? " has-value" : ""} pane-fade-in`}
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
