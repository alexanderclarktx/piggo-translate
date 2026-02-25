type TextPaneProps = {
  id: string
  title: string
  placeholder: string
  ariaLabel: string
  value: string
  readOnly?: boolean
  onChange?: (value: string) => void
  showHeader?: boolean
}

const TextPane = ({
  id, title, placeholder, ariaLabel, value, readOnly = false, onChange, showHeader = true
}: TextPaneProps) => {
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
        className="pane-textarea"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </section>
  )
}

export { TextPane }
