type TextPaneProps = {
  id: string
  title: string
  placeholder: string
  ariaLabel: string
  value: string
  readOnly?: boolean
  onChange?: (value: string) => void
}

const TextPane = ({
  id, title, placeholder, ariaLabel, value, readOnly = false, onChange
}: TextPaneProps) => {
  return (
    <section className="pane" aria-labelledby={id}>
      <div className="pane-header">
        <h2 id={id}>{title}</h2>
      </div>

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
