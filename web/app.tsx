import { useState } from "react"
import { createRoot } from "react-dom/client"

type TranslateResponse = {
  text?: string
  error?: string
}

type LanguageOption = {
  label: string
  value: string
}

const languageOptions: LanguageOption[] = [
  { label: "English", value: "English" },
  { label: "Chinese", value: "Chinese (simplified)" },
  { label: "French", value: "French" },
  { label: "Spanish", value: "Spanish" },
  { label: "Italian", value: "Italian" },
  { label: "Japanese", value: "Japanese" },
  { label: "Korean", value: "Korean" },
  { label: "Russian", value: "Russian" }
]

const getTranslateApiUrl = () => {
  const { protocol, hostname, port } = window.location

  if (port === "5000") {
    return `${protocol}//${hostname}:5001/api/translate`
  }

  return "/api/translate"
}

const App = () => {
  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [errorText, setErrorText] = useState("")
  const [isTranslating, setIsTranslating] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState(
    languageOptions[1]?.value || "Chinese (simplified)"
  )

  const handleTranslate = async () => {
    const trimmedText = inputText.trim()

    if (!trimmedText || isTranslating) {
      return
    }

    setErrorText("")
    setIsTranslating(true)

    try {
      const response = await fetch(getTranslateApiUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          text: trimmedText,
          targetLanguage
        })
      })

      const data = (await response.json()) as TranslateResponse

      if (!response.ok) {
        throw new Error(data.error || "Translation failed")
      }

      setOutputText(data.text || "")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Translation failed"
      setErrorText(message)
    } finally {
      setIsTranslating(false)
    }
  }

  return (
    <main>
      <header>
        <h1>AI Translator</h1>
      </header>

      <section className="toolbar" aria-label="Translation controls">
        <div className="language-picker" role="group" aria-label="Target language">
          <p className="language-picker-label">Target language</p>
          <div className="language-bubbles">
            {languageOptions.map((option) => {
              const isSelected = option.value === targetLanguage

              return (
                <button
                  key={option.label}
                  className="language-bubble"
                  data-selected={isSelected ? "true" : "false"}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setTargetLanguage(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <button
          className="translate-button"
          type="button"
          onClick={handleTranslate}
          disabled={isTranslating || !inputText.trim()}
        >
          {isTranslating ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Translating...
            </>
          ) : (
            "Translate"
          )}
        </button>

        {errorText ? (
          <p className="status-text status-text-error" role="status">
            {errorText}
          </p>
        ) : null}
      </section>

      <section className="pane-grid" aria-label="Translator workspace">
        <section className="pane" aria-labelledby="input-pane-title">
          <div className="pane-header">
            <h2 id="input-pane-title">Input</h2>
          </div>

          <textarea
            className="pane-textarea"
            placeholder="Type or paste text to translate"
            aria-label="Text to translate"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
          />
        </section>

        <section className="pane" aria-labelledby="output-pane-title">
          <div className="pane-header">
            <h2 id="output-pane-title">Translated Output</h2>
          </div>

          <textarea
            className="pane-textarea"
            placeholder="Translation will appear here"
            aria-label="Translated text"
            value={outputText}
            readOnly
          />
        </section>
      </section>
    </main>
  )
}

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Missing root div with id 'root'")
}

createRoot(rootElement).render(<App />)
