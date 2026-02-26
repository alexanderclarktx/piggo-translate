import { LanguageOption, LanguagePicker } from "@template/web"

type TranslateToolbarProps = {
  errorText: string
  languageOptions: LanguageOption[]
  targetLanguage: string
  onLanguageSelect: (language: string) => void
}

const TranslateToolbar = ({
  errorText,
  languageOptions,
  targetLanguage,
  onLanguageSelect
}: TranslateToolbarProps) => {
  return (
    <section className="toolbar" aria-label="Translation controls">
      <LanguagePicker
        options={languageOptions}
        targetLanguage={targetLanguage}
        onSelect={onLanguageSelect}
      />

      {errorText ? (
        <p className="status-text status-text-error" role="status">
          {errorText}
        </p>
      ) : null}
    </section>
  )
}

export { TranslateToolbar }
