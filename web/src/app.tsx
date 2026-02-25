import { useState } from "react"
import { createRoot } from "react-dom/client"
import type { LanguageOption } from "./components/LanguagePicker"
import { TextPane } from "./components/TextPane"
import { TranslateToolbar } from "./components/TranslateToolbar"

type TranslateResponse = {
  text?: string
  error?: string
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

  const handleTranslate = async (nextTargetLanguage = targetLanguage) => {
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
          targetLanguage: nextTargetLanguage
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

      <TranslateToolbar
        errorText={errorText}
        inputText={inputText}
        isTranslating={isTranslating}
        languageOptions={languageOptions}
        targetLanguage={targetLanguage}
        onLanguageSelect={(language) => {
          setTargetLanguage(language)
          void handleTranslate(language)
        }}
        onTranslate={() => {
          void handleTranslate()
        }}
      />

      <section className="pane-stack" aria-label="Translator workspace">
        <TextPane
          id="input-pane-title"
          title="Input"
          placeholder="Type or paste text to translate"
          ariaLabel="Text to translate"
          value={inputText}
          onChange={setInputText}
        />

        <TextPane
          id="output-pane-title"
          title="Translated Output"
          placeholder="Translation will appear here"
          ariaLabel="Translated text"
          value={outputText}
          readOnly
        />
      </section>
    </main>
  )
}

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Missing root div with id 'root'")
}

createRoot(rootElement).render(<App />)
