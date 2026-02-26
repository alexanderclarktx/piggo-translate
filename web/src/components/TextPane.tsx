import { ReactNode, useLayoutEffect, useRef } from "react"

type TextPaneProps = {
  id: string
  title: string
  placeholder: string
  ariaLabel: string
  value: string
  afterTextarea?: ReactNode
  footer?: ReactNode
  readOnly: boolean
  autoFocus: boolean
  onChange?: (value: string) => void
  showHeader: boolean
}

const TextPane = ({
  id, title, placeholder, ariaLabel, value, afterTextarea, footer, readOnly, autoFocus, onChange, showHeader
}: TextPaneProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = "0px"
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  return (
    <section
      className={showHeader ? "pane" : "pane pane-no-header"}
      aria-labelledby={showHeader ? id : undefined}
      aria-label={showHeader ? undefined : ariaLabel}
    >
      {showHeader ? (
        <div className="pane-header">
          <h2 id={id}>{title}</h2>
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        className="pane-textarea"
        rows={1}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        readOnly={readOnly}
        autoFocus={autoFocus}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange?.(event.target.value)}
        style={{
          textAlign: "center",
          // transform: "translate(-50%)"
        }}
      />

      {afterTextarea}
      {footer ? <div className="pane-footer">{footer}</div> : null}
    </section>
  )
}

export { TextPane }
