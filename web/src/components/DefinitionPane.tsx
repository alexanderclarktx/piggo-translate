type DefinitionPaneProps = {
  id: string
  title: string
  ariaLabel: string
  value: string
  className?: string
  showHeader: boolean
}

const DefinitionPane = ({ id, title, ariaLabel, value, className, showHeader }: DefinitionPaneProps) => {
  const paneClassName = ["definition-pane", className].filter(Boolean).join(" ")

  return (
    <section
      className={paneClassName}
      aria-labelledby={showHeader ? id : undefined}
      aria-label={showHeader ? undefined : ariaLabel}
    >
      {showHeader ? (
        <div className="definition-pane-header">
          <h2 id={id}>{title}</h2>
        </div>
      ) : null}

      <div
        className="definition-pane-text-content definition-pane-text-content-selectable"
        role="textbox"
        aria-label={ariaLabel}
      >
        {value}
      </div>
    </section>
  )
}

export { DefinitionPane }
