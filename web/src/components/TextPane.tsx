import { MutableRefObject, ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"

const textPaneAnimationMinIntervalMs = 10
const textPaneAnimationMaxIntervalMs = 110
const textPaneAnimationFastThreshold = 24
const selectableOutputTokenPattern = /[\p{Script=Han}]|[^\s\p{Script=Han}]+|\s+/gu

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
    return textPaneAnimationMaxIntervalMs
  }

  const clampedProgress = Math.min((workLeft - 1) / (textPaneAnimationFastThreshold - 1), 1)
  const intervalRange = textPaneAnimationMaxIntervalMs - textPaneAnimationMinIntervalMs

  const result = Math.round(textPaneAnimationMaxIntervalMs - (intervalRange * clampedProgress))
  return result
}

type TextPaneProps = {
  id: string
  title: string
  placeholder: string
  ariaLabel: string
  value: string
  className?: string
  afterTextarea?: ReactNode
  footer?: ReactNode
  readOnly: boolean
  autoFocus: boolean
  onChange?: (value: string) => void
  onSelectionChange?: (selection: string) => void
  showHeader: boolean
  textareaRef?: MutableRefObject<HTMLTextAreaElement | null>
  enableTokenSelection?: boolean
}

const TextPane = ({
  id, title, placeholder, ariaLabel, value, className, afterTextarea, footer, readOnly, autoFocus, onChange, onSelectionChange, showHeader, textareaRef, enableTokenSelection
}: TextPaneProps) => {
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const textContentRef = useRef<HTMLDivElement | null>(null)
  const lastSelectionRef = useRef("")
  const [text, setText] = useState(value)
  const [desiredText, setDesiredText] = useState(value)
  const paneClassName = [showHeader ? "pane" : "pane pane-no-header", className].filter(Boolean).join(" ")
  const selectableTokens = text.match(selectableOutputTokenPattern) ?? []
  const shouldRenderSelectableOutput = !!enableTokenSelection

  useEffect(() => {
    setDesiredText(value)

    // if (!readOnly) {
    //   setText(value)
    // }
  }, [readOnly, value])

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

  useLayoutEffect(() => {
    if (shouldRenderSelectableOutput) {
      return
    }

    const textarea = localTextareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "auto"
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [shouldRenderSelectableOutput, text])

  useEffect(() => {
    if (!shouldRenderSelectableOutput || !onSelectionChange) {
      return
    }

    const handleSelectionChange = () => {
      const contentElement = textContentRef.current
      const selection = window.getSelection()

      if (!contentElement || !selection || selection.rangeCount === 0) {
        lastSelectionRef.current = ""
        return
      }

      const range = selection.getRangeAt(0)
      const isSelectionInsideText =
        contentElement.contains(range.startContainer) &&
        contentElement.contains(range.endContainer)

      if (!isSelectionInsideText) {
        return
      }

      const nextSelection = selection.toString()

      if (!nextSelection || nextSelection === lastSelectionRef.current) {
        return
      }

      lastSelectionRef.current = nextSelection
      onSelectionChange(nextSelection)
    }

    document.addEventListener("selectionchange", handleSelectionChange)

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange)
    }
  }, [onSelectionChange, shouldRenderSelectableOutput])

  const selectToken = (tokenElement: HTMLSpanElement) => {
    const selection = window.getSelection()

    if (!selection) {
      return
    }

    const range = document.createRange()
    range.selectNodeContents(tokenElement)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  return (
    <section
      className={paneClassName}
      aria-labelledby={showHeader ? id : undefined}
      aria-label={showHeader ? undefined : ariaLabel}
    >
      {showHeader ? (
        <div className="pane-header">
          <h2 id={id}>{title}</h2>
        </div>
      ) : null}

      {shouldRenderSelectableOutput ? (
        <div
          ref={textContentRef}
          className="pane-text-content pane-text-content-selectable"
          role="textbox"
          aria-label={ariaLabel}
        >
          {selectableTokens.map((token, tokenIndex) => {
            if (!token.trim()) {
              return token
            }

            return (
              <span
                key={`${token}-${tokenIndex}`}
                className="pane-text-token"
                onClick={(event) => {
                  selectToken(event.currentTarget)
                }}
              >
                {token}
              </span>
            )
          })}
        </div>
      ) : (
        <textarea
          ref={(node) => {
            localTextareaRef.current = node

            if (textareaRef) {
              textareaRef.current = node
            }
          }}
          className="pane-textarea"
          rows={1}
          placeholder={placeholder}
          aria-label={ariaLabel}
          value={text}
          readOnly={readOnly}
          autoFocus={autoFocus}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            const nextValue = event.target.value

            setText(nextValue)
            setDesiredText(nextValue)
            onChange?.(nextValue)
          }}
          style={{
            textAlign: "center",
            // transform: "translate(-50%)"
          }}
        />
      )}

      {afterTextarea}
      {footer ? footer : null}
    </section>
  )
}

export { TextPane }
