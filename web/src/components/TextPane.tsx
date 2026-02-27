import { MutableRefObject, ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"

const textPaneAnimationMinIntervalMs = 15
const textPaneAnimationMaxIntervalMs = 100
const textPaneAnimationFastThreshold = 24
const selectableOutputTokenPattern = /[\p{Script=Han}]|[^\s\p{Script=Han}]+|\s+/gu
const selectionWordStripPattern = /[^\p{L}\p{M}\p{N}\p{Script=Han}]+/gu

const getSelectionWord = (value: string) => value.replace(selectionWordStripPattern, "")

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

const buildSelectableDisplayText = (
  tokens: {
    value: string
  }[],
  shouldUseWordJoiner: boolean,
  selectionWordJoiner: string
) => {
  if (!tokens.length) {
    return ""
  }

  return tokens.reduce((result, token, tokenIndex) => {
    const joiner =
      shouldUseWordJoiner && tokenIndex < tokens.length - 1 ? selectionWordJoiner : ""
    return `${result}${token.value}${joiner}`
  }, "")
}

const getAnimatedSelectableTokens = (
  targetTokens: {
    value: string
    selectionWord?: string
    selectable?: boolean
  }[],
  animatedText: string,
  shouldUseWordJoiner: boolean,
  selectionWordJoiner: string
) => {
  if (!targetTokens.length || !animatedText) {
    return []
  }

  let remainingText = animatedText

  const nextTokens = targetTokens.flatMap((token, tokenIndex) => {
    if (!remainingText) {
      return []
    }

    const visibleTokenValue = remainingText.slice(0, token.value.length)
    remainingText = remainingText.slice(visibleTokenValue.length)
    const tokenEntries: {
      value: string
      selectionWord?: string
      selectable?: boolean
    }[] = []
    const isTokenFullyVisible = visibleTokenValue.length === token.value.length

    if (visibleTokenValue) {
      tokenEntries.push({
        value: visibleTokenValue,
        selectionWord: isTokenFullyVisible ? token.selectionWord : "",
        selectable: isTokenFullyVisible ? token.selectable : false
      })
    }

    const shouldAppendJoiner =
      shouldUseWordJoiner &&
      tokenIndex < targetTokens.length - 1 &&
      !!selectionWordJoiner

    if (shouldAppendJoiner && remainingText) {
      const visibleJoinerValue = remainingText.slice(0, selectionWordJoiner.length)

      if (visibleJoinerValue) {
        tokenEntries.push({
          value: visibleJoinerValue,
          selectionWord: "",
          selectable: false
        })
        remainingText = remainingText.slice(visibleJoinerValue.length)
      }
    }

    return tokenEntries
  })

  return nextTokens
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
  onSelectionChange?: (selectionWords: string[]) => void
  showHeader: boolean
  textareaRef?: MutableRefObject<HTMLTextAreaElement | null>
  enableTokenSelection?: boolean
  animateOnMount?: boolean
  selectionWords?: string[]
  selectionTokens?: {
    value: string
    selectionWord?: string
    selectable?: boolean
  }[]
  selectionWordJoiner?: string
}

const TextPane = ({
  id, title, placeholder, ariaLabel, value, className, afterTextarea, footer, readOnly, autoFocus, onChange, onSelectionChange, showHeader, textareaRef, enableTokenSelection, animateOnMount, selectionWords, selectionTokens, selectionWordJoiner = " "
}: TextPaneProps) => {
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const textContentRef = useRef<HTMLDivElement | null>(null)
  const lastSelectionRef = useRef("")
  const shouldAnimateOnMountRef = useRef(!!animateOnMount)
  const initialText = shouldAnimateOnMountRef.current ? "" : value
  const [text, setText] = useState(initialText)
  const [desiredText, setDesiredText] = useState(value)
  const paneClassName = [showHeader ? "pane" : "pane pane-no-header", className].filter(Boolean).join(" ")
  const normalizedSelectionTokens =
    selectionTokens && selectionTokens.length
      ? selectionTokens
      : selectionWords && selectionWords.length
        ? selectionWords.map((value) => {
          const selectionWord = getSelectionWord(value)
          return {
            value,
            selectionWord,
            selectable: !!selectionWord
          }
        })
        : []
  const shouldUseSelectionTokens =
    normalizedSelectionTokens.length > 0
  const shouldUseWordJoiner = shouldUseSelectionTokens && normalizedSelectionTokens.length > 1
  const selectableTextTarget = shouldUseSelectionTokens
    ? buildSelectableDisplayText(normalizedSelectionTokens, shouldUseWordJoiner, selectionWordJoiner)
    : value
  const staticSelectableTokens = shouldUseSelectionTokens
    ? normalizedSelectionTokens
    : (text.match(selectableOutputTokenPattern) ?? []).map((token) => {
      const selectionWord = getSelectionWord(token)
      return {
        value: token,
        selectionWord,
        selectable: !!selectionWord
      }
    })
  const selectableTokens = shouldUseSelectionTokens
    ? getAnimatedSelectableTokens(
      staticSelectableTokens,
      text,
      shouldUseWordJoiner,
      selectionWordJoiner
    )
    : staticSelectableTokens
  const shouldRenderSelectableOutput = !!enableTokenSelection

  useEffect(() => {
    if (shouldAnimateOnMountRef.current) {
      shouldAnimateOnMountRef.current = false
    }
    setDesiredText(selectableTextTarget)

    // if (!readOnly) {
    //   setText(value)
    // }
  }, [readOnly, selectableTextTarget])

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

    const getTokenElementFromNode = (node: Node | null) => {
      if (!node) {
        return null
      }

      const element = node instanceof Element ? node : node.parentElement
      return element?.closest<HTMLSpanElement>(".pane-text-token") ?? null
    }

    const updateSelectedTokenStyles = (range: Range | null) => {
      const contentElement = textContentRef.current

      if (!contentElement) {
        return
      }

      const tokenElements = Array.from(contentElement.querySelectorAll<HTMLSpanElement>(".pane-text-token"))
      tokenElements.forEach((tokenElement) => {
        tokenElement.classList.remove("pane-text-token-selected")
        tokenElement.classList.remove("pane-text-token-selected-start")
        tokenElement.classList.remove("pane-text-token-selected-end")
      })

      if (!range || range.collapsed) {
        return
      }

      tokenElements.forEach((tokenElement) => {
        if (range.intersectsNode(tokenElement)) {
          tokenElement.classList.add("pane-text-token-selected")
        }
      })

      tokenElements.forEach((tokenElement, tokenIndex) => {
        const isSelected = tokenElement.classList.contains("pane-text-token-selected")
        const isPreviousSelected = tokenElements[tokenIndex - 1]?.classList.contains("pane-text-token-selected")
        const isNextSelected = tokenElements[tokenIndex + 1]?.classList.contains("pane-text-token-selected")

        if (isSelected && !isPreviousSelected) {
          tokenElement.classList.add("pane-text-token-selected-start")
        }

        if (isSelected && !isNextSelected) {
          tokenElement.classList.add("pane-text-token-selected-end")
        }
      })
    }

    const clearSelection = () => {
      if (!lastSelectionRef.current) {
        return
      }

      lastSelectionRef.current = ""
      onSelectionChange([])
    }

    const handleSelectionChange = () => {
      const contentElement = textContentRef.current
      const selection = window.getSelection()

      if (!contentElement || !selection || selection.rangeCount === 0) {
        return
      }

      const range = selection.getRangeAt(0)
      const isSelectionInsideText =
        contentElement.contains(range.startContainer) &&
        contentElement.contains(range.endContainer)

      if (!isSelectionInsideText) {
        return
      }

      if (selection.isCollapsed) {
        return
      }

      const tokenElements = Array.from(contentElement.querySelectorAll<HTMLSpanElement>(".pane-text-token"))
      const anchorTokenElement = getTokenElementFromNode(selection.anchorNode)
      const focusTokenElement = getTokenElementFromNode(selection.focusNode)
      const selectedTokenElement =
        [anchorTokenElement, focusTokenElement].find((tokenElement) =>
          !!tokenElement &&
          contentElement.contains(tokenElement) &&
          !!tokenElement.dataset.selectionWord
        ) ||
        tokenElements.find((tokenElement) =>
          range.intersectsNode(tokenElement) &&
          !!tokenElement.dataset.selectionWord
        ) ||
        null

      if (!selectedTokenElement) {
        updateSelectedTokenStyles(null)
        clearSelection()
        return
      }

      const selectedWord = selectedTokenElement.dataset.selectionWord || getSelectionWord(selectedTokenElement.textContent || "")
      const nextSelectionKey = selectedWord

      if (!nextSelectionKey) {
        updateSelectedTokenStyles(null)
        clearSelection()
        return
      }

      const normalizedRange = document.createRange()
      normalizedRange.selectNodeContents(selectedTokenElement)
      selection.removeAllRanges()
      selection.addRange(normalizedRange)
      updateSelectedTokenStyles(normalizedRange)

      if (nextSelectionKey === lastSelectionRef.current) {
        return
      }

      lastSelectionRef.current = nextSelectionKey
      onSelectionChange([selectedWord])
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

  const clearSelectableOutputSelection = () => {
    if (!onSelectionChange) {
      return
    }

    const selection = window.getSelection()
    selection?.removeAllRanges()

    const contentElement = textContentRef.current

    if (contentElement) {
      const tokenElements = Array.from(contentElement.querySelectorAll<HTMLSpanElement>(".pane-text-token"))
      tokenElements.forEach((tokenElement) => {
        tokenElement.classList.remove("pane-text-token-selected")
        tokenElement.classList.remove("pane-text-token-selected-start")
        tokenElement.classList.remove("pane-text-token-selected-end")
      })
    }

    if (!lastSelectionRef.current) {
      return
    }

    lastSelectionRef.current = ""
    onSelectionChange([])
  }

  useEffect(() => {
    if (!shouldRenderSelectableOutput) {
      return
    }

    clearSelectableOutputSelection()
  }, [shouldRenderSelectableOutput, value])

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
          onMouseDown={(event) => {
            const tokenElement = (event.target as Element).closest<HTMLSpanElement>(".pane-text-token")
            const isWordToken = !!tokenElement && !!tokenElement.dataset.selectionWord

            if (!isWordToken) {
              clearSelectableOutputSelection()
            }
          }}
        >
          {selectableTokens.map((token, tokenIndex) => {
            const tokenValue = token.value
            const isWhitespaceToken = !tokenValue.trim()
            const selectionWord = token.selectionWord ?? getSelectionWord(tokenValue)
            const isSelectableToken = token.selectable ?? !!selectionWord
            const tokenClassName = [
              "pane-text-token",
              isWhitespaceToken ? "pane-text-token-space" : "",
              isSelectableToken ? "pane-text-token-selectable" : "pane-text-token-nonselectable"
            ].filter(Boolean).join(" ")

            return (
              <span key={`${tokenValue}-${tokenIndex}`}>
                <span
                  className={tokenClassName}
                  data-selection-word={isSelectableToken ? selectionWord : ""}
                  onMouseDown={(event) => {
                    if (isWhitespaceToken || !isSelectableToken) {
                      return
                    }

                    event.preventDefault()
                    selectToken(event.currentTarget)
                  }}
                >
                  {tokenValue}
                </span>
                {shouldUseWordJoiner && tokenIndex < selectableTokens.length - 1 ? selectionWordJoiner : null}
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
        />
      )}

      {afterTextarea}
      {footer ? footer : null}
    </section>
  )
}

export { TextPane }
