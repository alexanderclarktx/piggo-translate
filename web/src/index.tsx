import {
  TargetLanguageDropdown, TextPane, Transliteration, normalizeDefinition,
  Cache, Client, RequestSnapshot, isLocal, isMobile
} from "@template/web"
import { Model, WordDefinition, WordToken } from "@template/core"
import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

export type LanguageOption = {
  label: string
  value: string
}

const languageOptions: LanguageOption[] = [
  { label: "Chinese", value: "Chinese (simplified)" },
  { label: "English", value: "English" },
  { label: "Spanish", value: "Spanish" },
  { label: "Japanese", value: "Japanese" },
  { label: "Russian", value: "Russian" },
  { label: "French", value: "French" },
  // { label: "Italian", value: "Italian" },
  // { label: "Korean", value: "Korean" },
]

const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim()
const isSpaceSeparatedLanguage = (language: string) =>
  !language.toLowerCase().includes("chinese") &&
  !language.toLowerCase().includes("japanese")
const noSpaceBeforePunctuationPattern = /^[.,!?;:%)\]\}»”’、。，！？；：]$/
const noSpaceAfterPunctuationPattern = /^[(\[{«“‘]$/

const joinOutputTokens = (
  tokens: WordToken[],
  targetLanguage: string,
  tokenKey: "word" | "literal",
  options?: {
    forceSpaceSeparated?: boolean
  }
) => {
  const useSpaces = options?.forceSpaceSeparated || isSpaceSeparatedLanguage(targetLanguage)

  return tokens.reduce((result, token, tokenIndex) => {
    const tokenValue = token[tokenKey]

    if (!tokenValue) {
      return result
    }

    if (!result) {
      return tokenValue
    }

    if (!useSpaces) {
      return `${result}${tokenValue}`
    }

    const previousToken = tokens[tokenIndex - 1]
    const previousWord = previousToken?.word || ""
    const hasNoSpaceBefore = token.punctuation && noSpaceBeforePunctuationPattern.test(token.word)
    const hasNoSpaceAfterPrevious = !!previousToken?.punctuation && noSpaceAfterPunctuationPattern.test(previousWord)
    const joiner = hasNoSpaceBefore || hasNoSpaceAfterPrevious ? "" : " "
    return `${result}${joiner}${tokenValue}`
  }, "")
}

const isEditableElement = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) {
    return false
  }

  if (element instanceof HTMLTextAreaElement) {
    return !element.readOnly && !element.disabled
  }

  if (element instanceof HTMLInputElement) {
    return !element.readOnly && !element.disabled
  }

  return element.isContentEditable
}

const App = () => {
  const [inputText, setInputText] = useState("")
  const [outputWords, setOutputWords] = useState<WordToken[]>([])
  const [isTransliterationVisible, setIsTransliterationVisible] = useState(true)
  const [errorText, setErrorText] = useState("")
  const [isTranslating, setIsTranslating] = useState(false)
  const [isSocketOpen, setIsSocketOpen] = useState(false)
  const [latestRequestSnapshot, setLatestRequestSnapshot] = useState<RequestSnapshot>({
    id: "",
    normalizedInputText: ""
  })
  const [debouncedRequest, setDebouncedRequest] = useState<{
    text: string
    targetLanguage: string
    model: Model
  } | null>(null)
  const [targetLanguage, setTargetLanguage] = useState(languageOptions[0].value)
  const [selectedModel, setSelectedModel] = useState<Model>("openai")
  const [selectedOutputWords, setSelectedOutputWords] = useState<string[]>([])
  const [wordDefinitions, setWordDefinitions] = useState<WordDefinition[]>([])
  const [isDefinitionLoading, setIsDefinitionLoading] = useState(false)
  const [isConnectionDotDelayComplete, setIsConnectionDotDelayComplete] = useState(false)
  const clientRef = useRef<Client | null>(null)
  const inputTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingInputSelectionRef = useRef<{ start: number, end: number } | null>(null)
  const selectedOutputWordsRef = useRef<string[]>([])
  const targetLanguageRef = useRef(targetLanguage)
  const selectedModelRef = useRef(selectedModel)
  const CacheRef = useRef(Cache())
  const headerSectionRef = useRef<HTMLElement | null>(null)
  const paneStackRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsConnectionDotDelayComplete(true)
    }, 1000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    const headerSection = headerSectionRef.current
    const paneStack = paneStackRef.current

    if (!headerSection || !paneStack) return
    if (isMobile()) return

    const updatePaneStackMarginTop = () => {
      const minimumGapFromHeader = 16
      const minimumGapFromViewportBottom = 16
      const headerBottom = headerSection.getBoundingClientRect().bottom
      const paneStackHeight = paneStack.getBoundingClientRect().height
      const centeredTop = Math.max((window.innerHeight - paneStackHeight) / 2, 0)
      const targetTop = Math.max(centeredTop, headerBottom + minimumGapFromHeader)
      const marginTop = Math.max(targetTop - headerBottom - 40, 0)

      paneStack.style.marginTop = `${marginTop}px`
      const paneStackTop = paneStack.getBoundingClientRect().top
      const maxHeight = Math.max(window.innerHeight - paneStackTop - minimumGapFromViewportBottom, 0)
      paneStack.style.maxHeight = `${maxHeight}px`
    }

    const resizeObserver = new ResizeObserver(() => {
      updatePaneStackMarginTop()
    })

    resizeObserver.observe(paneStack)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const normalizedInputText = normalizeText(inputText)
  const hasInputText = !!normalizedInputText
  const hasOutputWords = outputWords.length > 0
  const isSpinnerVisible =
    isTranslating &&
    !!latestRequestSnapshot.id &&
    normalizedInputText === latestRequestSnapshot.normalizedInputText

  useEffect(() => {
    const client = Client({
      onSocketOpenChange: setIsSocketOpen,
      onErrorTextChange: setErrorText,
      onTranslatingChange: setIsTranslating,
      onDefinitionLoadingChange: setIsDefinitionLoading,
      onLatestRequestChange: setLatestRequestSnapshot,
      onTranslateSuccess: (words) => {
        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
        }

        setOutputWords(words)
        setSelectedOutputWords([])
        setWordDefinitions([])
        setIsDefinitionLoading(false)
        client.clearDefinitionRequestState()
      },
      onTranslateError: (error) => {
        setErrorText(error)
      },
      onDefinitionsSuccess: (definitions) => {
        CacheRef.current.writeDefinitionsToCache(definitions)
        const selectedWords = selectedOutputWordsRef.current
        setWordDefinitions(CacheRef.current.getCachedDefinitions(selectedWords))
        const missingWords = CacheRef.current.getMissingDefinitionWords(selectedWords)

        if (missingWords.length) {
          client.sendDefinitionsRequest({
            word: missingWords[0],
            targetLanguage: targetLanguageRef.current,
            model: selectedModelRef.current
          })
        } else {
          setIsDefinitionLoading(false)
        }
      },
      onDefinitionsError: () => {
        setWordDefinitions([])
        setIsDefinitionLoading(false)
      }
    })

    clientRef.current = client
    client.connect()

    return () => {
      client.dispose()
      clientRef.current = null
    }
  }, [])

  useEffect(() => {
    targetLanguageRef.current = targetLanguage
  }, [targetLanguage])

  useEffect(() => {
    selectedModelRef.current = selectedModel
  }, [selectedModel])

  useEffect(() => {
    selectedOutputWordsRef.current = selectedOutputWords
  }, [selectedOutputWords])

  useEffect(() => {
    const textarea = inputTextareaRef.current
    const pendingSelection = pendingInputSelectionRef.current

    if (!textarea || !pendingSelection) {
      return
    }

    pendingInputSelectionRef.current = null
    textarea.setSelectionRange(pendingSelection.start, pendingSelection.end)
  }, [inputText])

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const textarea = inputTextareaRef.current
      if (!textarea) return

      textarea.focus()

      if (
        event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey
      ) return

      const activeElement = document.activeElement

      if (activeElement === textarea) return

      if (isEditableElement(activeElement)) return

      event.preventDefault()

      const selectionStart = textarea.selectionStart ?? textarea.value.length
      const selectionEnd = textarea.selectionEnd ?? textarea.value.length
      const isBackspaceKey = event.key === "Backspace"
      const deleteStart =
        isBackspaceKey && selectionStart === selectionEnd
          ? Math.max(0, selectionStart - 1)
          : selectionStart
      const deleteEnd = selectionEnd
      const insertedText = isBackspaceKey ? "" : event.key
      const nextValue =
        `${textarea.value.slice(0, deleteStart)}${insertedText}${textarea.value.slice(deleteEnd)}`
      const nextCursorPosition = deleteStart + insertedText.length

      pendingInputSelectionRef.current = {
        start: nextCursorPosition,
        end: nextCursorPosition
      }
      setInputText(nextValue)
    }

    window.addEventListener("keydown", handleWindowKeyDown)

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown)
    }
  }, [])

  // if input changes
  useEffect(() => {
    const trimmedText = inputText.trim()
    clientRef.current?.setCurrentNormalizedInputText(normalizedInputText)

    if (!trimmedText) {
      setOutputWords([])
      setSelectedOutputWords([])
      setWordDefinitions([])
      setIsDefinitionLoading(false)
      setErrorText("")
      setDebouncedRequest(null)
      clientRef.current?.clearAllRequestState()
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedRequest({
        text: trimmedText,
        targetLanguage,
        model: selectedModel
      })
    }, 400)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [inputText, normalizedInputText])

  // if language changes
  useEffect(() => {
    const trimmedText = inputText.trim()

    if (!trimmedText) {
      setOutputWords([])
      setSelectedOutputWords([])
      setWordDefinitions([])
      setIsDefinitionLoading(false)
      setErrorText("")
      setDebouncedRequest(null)
      clientRef.current?.clearAllRequestState()
      return
    }

    setDebouncedRequest({
      text: trimmedText,
      targetLanguage,
      model: selectedModel
    })
  }, [targetLanguage])

  useEffect(() => {
    if (!debouncedRequest || !isSocketOpen) {
      return
    }

    clientRef.current?.sendTranslateRequest(debouncedRequest)
  }, [debouncedRequest, isSocketOpen])

  useEffect(() => {
    if (!selectedOutputWords.length) {
      setWordDefinitions([])
      setIsDefinitionLoading(false)
      clientRef.current?.clearDefinitionRequestState()
      return
    }

    const uniqueWords = Array.from(new Set(selectedOutputWords))
    const cachedDefinitions = CacheRef.current.getCachedDefinitions(uniqueWords)
    setWordDefinitions(cachedDefinitions)

    const missingWords = CacheRef.current.getMissingDefinitionWords(uniqueWords)

    if (!missingWords.length) {
      setIsDefinitionLoading(false)
      clientRef.current?.clearDefinitionRequestState()
      return
    }

    if (!isSocketOpen) return

    clientRef.current?.sendDefinitionsRequest({
      word: missingWords[0],
      targetLanguage,
      model: selectedModel
    })
  }, [selectedOutputWords, isSocketOpen, selectedModel, targetLanguage])

  const definitionByWord = new Map(
    wordDefinitions.map((entry) => [normalizeDefinition(entry.word), entry.definition])
  )
  const transliterationByWord = new Map<string, string>()

  outputWords
    .filter(({ punctuation }) => !punctuation)
    .forEach(({ word, literal }) => {
      const normalizedWord = normalizeDefinition(word)
      const transliterationKey = normalizedWord || word

      if (transliterationByWord.has(transliterationKey)) {
        return
      }

      if (literal) {
        transliterationByWord.set(transliterationKey, literal)
      }
    })

  return (
    <main>
      <section ref={headerSectionRef} style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "1rem",
        flexDirection: "column",
        left: "50%"
      }}>
        <img src="piggo.svg" alt="" aria-hidden="true" className="title-icon fade-in" draggable={false} />
        <p className="header-title">Piggo Translate</p>
      </section>

      {/* <TranslateToolbar
        errorText={errorText}
        languageOptions={languageOptions}
        targetLanguage={targetLanguage}
        onLanguageSelect={(language) => {
          setTargetLanguage(language)
        }}
      /> */}

      <section ref={paneStackRef} className="pane-stack" aria-label="Translator workspace">
        {!isSocketOpen && isConnectionDotDelayComplete ? (
          <span className="pane-stack-connection-dot fade-in" aria-hidden="true" />
        ) : null}

        <TargetLanguageDropdown
          options={languageOptions}
          targetLanguage={targetLanguage}
          onSelect={setTargetLanguage}
        />

        <TextPane
          id="input-pane-title"
          title="Input"
          showHeader={false}
          placeholder=""
          ariaLabel="Text to translate"
          value={inputText}
          autoFocus
          textareaRef={inputTextareaRef}
          onChange={setInputText}
          afterTextarea={hasInputText && isSpinnerVisible ? (
            <span className="spinner pane-spinner" aria-hidden="true" />
          ) : null}
          readOnly={false}
          className="fade-in"
        />

        {hasOutputWords ? (
          <TextPane
            id="output-pane-title"
            title="Translated Output"
            showHeader={false}
            placeholder=""
            ariaLabel="Translated text"
            value={joinOutputTokens(outputWords, targetLanguage, "word")}
            selectionTokens={outputWords.map((token) => ({
              value: token.word,
              selectionWord: token.word,
              selectable: !token.punctuation
            }))}
            selectionWordJoiner={isSpaceSeparatedLanguage(targetLanguage) ? " " : ""}
            autoFocus={false}
            animateOnMount
            footer={(
              <Transliteration
                value={joinOutputTokens(outputWords, targetLanguage, "literal", { forceSpaceSeparated: true })}
                isVisible={isTransliterationVisible}
                onToggle={() => setIsTransliterationVisible((value) => !value)}
              />
            )}
            readOnly
            enableTokenSelection
            enableCopyButton
            copyValue={joinOutputTokens(outputWords, targetLanguage, "word")}
            onSelectionChange={(selectionWords) => {
              setSelectedOutputWords(selectionWords)
            }}
          />
        ) : null}

        {selectedOutputWords.map((word, index) => {
          const normalizedWord = normalizeDefinition(word)
          const definition = definitionByWord.get(normalizedWord) || ""
          const transliteration = transliterationByWord.get(normalizedWord || word) || ""
          const wordWithTransliteration = transliteration ? `${word} (${transliteration})` : word
          const paneValue = definition ? `${wordWithTransliteration} — ${definition}` : wordWithTransliteration

          return (
            <TextPane
              key={`${word}-${index}`}
              id={`definition-pane-${index}-title`}
              title=""
              showHeader={false}
              className="pane-definition fade-in"
              placeholder=""
              ariaLabel={`Definition for ${word}`}
              value={paneValue}
              autoFocus={false}
              readOnly
              enableContentSelection
            />
          )
        })}

      </section>

      {/* <div className="pane-switch-row" aria-label="Model selection">
        <ModelSwitch
          className="output-pane-model-switch"
          selectedModel={selectedModel}
          onModelToggle={setSelectedModel}
        />
      </div> */}

      {isLocal() && !isMobile() && (
        <span className="app-version" aria-label="App version">
          v0.2.2
        </span>
      )}
    </main>
  )
}

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Missing root div with id 'root'")
}

createRoot(rootElement).render(<App />)
