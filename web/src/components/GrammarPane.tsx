import { useEffect, useRef, useState } from "react"
import { getDynamicIntervalDuration } from "./paneUtils"

type GrammarPaneProps = {
  id: string
  title: string
  ariaLabel: string
  value: string
  className?: string
  showHeader: boolean
  animateOnMount?: boolean
}

const GrammarPane = ({
  id, title, ariaLabel, value, className, showHeader, animateOnMount
}: GrammarPaneProps) => {
  const shouldAnimateOnMountRef = useRef(!!animateOnMount)
  const paneClassName = ["grammar-pane", className].filter(Boolean).join(" ")
  const initialText = shouldAnimateOnMountRef.current ? "" : value
  const [text, setText] = useState(initialText)
  const [desiredText, setDesiredText] = useState(value)

  useEffect(() => {
    if (shouldAnimateOnMountRef.current) {
      shouldAnimateOnMountRef.current = false
    }

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
    <section
      className={paneClassName}
      aria-labelledby={showHeader ? id : undefined}
      aria-label={showHeader ? undefined : ariaLabel}
    >
      {showHeader ? (
        <div className="grammar-pane-header">
          <h2 id={id}>{title}</h2>
        </div>
      ) : null}

      <div
        className="grammar-pane-text-content grammar-pane-text-content-selectable"
        role="textbox"
        aria-label={ariaLabel}
      >
        {text}
      </div>
    </section>
  )
}

export { GrammarPane }
