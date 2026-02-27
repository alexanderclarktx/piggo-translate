import {
  TranslateModel,
  TranslateWordDefinition,
  TranslateWordToken,
  TranslateWsDefinitionsRequestMessage,
  TranslateWsRequestMessage,
  TranslateWsServerMessage
} from "@template/core"
import { LanguageOption, TextPane, Transliteration, TranslateToolbar } from "@template/web"
import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

const languageOptions: LanguageOption[] = [
  { label: "English", value: "English" },
  { label: "Chinese", value: "Chinese (simplified)" },
  { label: "Spanish", value: "Spanish" },
  { label: "Japanese", value: "Japanese" },
  { label: "Russian", value: "Russian" }
  // { label: "French", value: "French" },
  // { label: "Italian", value: "Italian" },
  // { label: "Korean", value: "Korean" },
]

const getTranslateWsUrl = () => {
  const { hostname } = window.location
  return hostname === "localhost" ? "http://localhost:5001/api/ws" : "https://piggo-translate-production.up.railway.app/api/ws"
}

const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim()
const definitionWordStripPattern = /[^\p{L}\p{M}\p{N}\p{Script=Han}]+/gu
const normalizeDefinitionWord = (word: string) => word.replace(definitionWordStripPattern, "")
const getUniqueDefinitionWords = (words: string[]) =>
  Array.from(new Set(words.map((word) => normalizeDefinitionWord(word)).filter(Boolean)))
const isSpaceSeparatedLanguage = (language: string) =>
  !language.toLowerCase().includes("chinese") &&
  !language.toLowerCase().includes("japanese")
const noSpaceBeforePunctuationPattern = /^[.,!?;:%)\]\}»”’、。，！？；：]$/
const noSpaceAfterPunctuationPattern = /^[(\[{«“‘]$/

const joinOutputTokens = (
  tokens: TranslateWordToken[],
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

const getRequestSignature = ({ text, targetLanguage, model }: { text: string, targetLanguage: string, model: TranslateModel }) => {
  const normalizedText = normalizeText(text)
  return `${model}::${normalizedText}::${targetLanguage}`
}

const getDefinitionRequestSignature = (
  word: string,
  targetLanguage: string,
  model: TranslateModel
) => {
  return `${model}::${targetLanguage}::${normalizeDefinitionWord(word)}`
}

const definitionCacheMaxItems = 10

const App = () => {
  const [inputText, setInputText] = useState("")
  const [outputWords, setOutputWords] = useState<TranslateWordToken[]>([])
  const [isTransliterationVisible, setIsTransliterationVisible] = useState(true)
  const [errorText, setErrorText] = useState("")
  const [isTranslating, setIsTranslating] = useState(false)
  const [isSocketOpen, setIsSocketOpen] = useState(false)
  const [latestRequestSnapshot, setLatestRequestSnapshot] = useState({
    id: "",
    normalizedInputText: ""
  })
  const [debouncedRequest, setDebouncedRequest] = useState<{
    text: string
    targetLanguage: string
    model: TranslateModel
  } | null>(null)
  const [targetLanguage, setTargetLanguage] = useState(languageOptions[1].value)
  const [selectedModel, setSelectedModel] = useState<TranslateModel>("openai")
  const [selectedOutputWords, setSelectedOutputWords] = useState<string[]>([])
  const [wordDefinitions, setWordDefinitions] = useState<TranslateWordDefinition[]>([])
  const [isDefinitionLoading, setIsDefinitionLoading] = useState(false)
  const [isConnectionDotDelayComplete, setIsConnectionDotDelayComplete] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const inputTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingInputSelectionRef = useRef<{ start: number, end: number } | null>(null)
  const reconnectTimeoutIdRef = useRef<number | null>(null)
  const requestCounterRef = useRef(0)
  const latestRequestRef = useRef({
    id: "",
    normalizedInputText: ""
  })
  const currentNormalizedInputTextRef = useRef("")
  const lastRequestedSignatureRef = useRef("")
  const latestDefinitionsRequestIdRef = useRef("")
  const lastDefinitionRequestSignatureRef = useRef("")
  const selectedOutputWordsRef = useRef<string[]>([])
  const definitionCacheRef = useRef<Record<string, string>>({})

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsConnectionDotDelayComplete(true)
    }, 1000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])
  const definitionCacheOrderRef = useRef<string[]>([])
  const normalizedInputText = normalizeText(inputText)
  const hasInputText = !!normalizedInputText
  const hasOutputWords = outputWords.length > 0
  const isSpinnerVisible =
    isTranslating &&
    !!latestRequestSnapshot.id &&
    normalizedInputText === latestRequestSnapshot.normalizedInputText

  const sendTranslateRequest = (requestInput: {
    text: string
    targetLanguage: string
    model: TranslateModel
  }) => {
    const socket = socketRef.current

    if (
      !requestInput.text ||
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      return
    }

    requestCounterRef.current += 1
    const requestId = `${Date.now()}-${requestCounterRef.current}`

    setErrorText("")
    setIsTranslating(true)
    latestRequestRef.current = {
      id: requestId,
      normalizedInputText: normalizeText(requestInput.text)
    }
    setLatestRequestSnapshot(latestRequestRef.current)
    lastRequestedSignatureRef.current = getRequestSignature(requestInput)

    const request: TranslateWsRequestMessage = {
      type: "translate.request",
      requestId,
      text: requestInput.text,
      targetLanguage: requestInput.targetLanguage,
      model: requestInput.model
    }

    // console.log("Sending translate request", request)

    socket.send(JSON.stringify(request))
  }

  const sendDefinitionsRequest = (word: string) => {
    const socket = socketRef.current
    const normalizedWord = normalizeDefinitionWord(word)

    if (!normalizedWord || !socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    const requestSignature = getDefinitionRequestSignature(normalizedWord, targetLanguage, selectedModel)

    if (lastDefinitionRequestSignatureRef.current === requestSignature) {
      return
    }

    requestCounterRef.current += 1
    const requestId = `${Date.now()}-${requestCounterRef.current}`
    latestDefinitionsRequestIdRef.current = requestId
    lastDefinitionRequestSignatureRef.current = requestSignature
    setIsDefinitionLoading(true)

    const request: TranslateWsDefinitionsRequestMessage = {
      type: "translate.definitions.request",
      requestId,
      word: normalizedWord,
      targetLanguage,
      model: selectedModel
    }

    // console.log("Sending definitions request", request)

    socket.send(JSON.stringify(request))
  }

  const getCachedDefinitions = (words: string[]) => {
    const uniqueWords = getUniqueDefinitionWords(words)
    return uniqueWords
      .map((word) => ({
        word,
        definition: definitionCacheRef.current[word] || ""
      }))
      .filter((entry) => !!entry.definition)
  }

  const getMissingDefinitionWords = (words: string[]) => {
    const uniqueWords = getUniqueDefinitionWords(words)
    const cachedWordSet = new Set(getCachedDefinitions(uniqueWords).map((entry) => entry.word))
    return uniqueWords.filter((word) => !cachedWordSet.has(word))
  }

  const writeDefinitionsToCache = (definitions: TranslateWordDefinition[]) => {
    definitions.forEach(({ word, definition }) => {
      const normalizedWord = normalizeDefinitionWord(word)

      if (!normalizedWord || !definition) {
        return
      }

      definitionCacheRef.current[normalizedWord] = definition
      definitionCacheOrderRef.current = definitionCacheOrderRef.current.filter((cachedWord) => cachedWord !== normalizedWord)
      definitionCacheOrderRef.current.push(normalizedWord)

      while (definitionCacheOrderRef.current.length > definitionCacheMaxItems) {
        const oldestWord = definitionCacheOrderRef.current.shift()

        if (!oldestWord) {
          return
        }

        delete definitionCacheRef.current[oldestWord]
      }
    })
  }

  useEffect(() => {
    let isDisposed = false

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutIdRef.current === null) {
        return
      }

      window.clearTimeout(reconnectTimeoutIdRef.current)
      reconnectTimeoutIdRef.current = null
    }

    const connectSocket = () => {
      clearReconnectTimeout()

      const socket = new WebSocket(getTranslateWsUrl())
      console.log("Connecting to websocket at", getTranslateWsUrl())
      socketRef.current = socket
      setIsSocketOpen(false)

      socket.addEventListener("open", () => {
        if (isDisposed || socketRef.current !== socket) {
          return
        }

        setIsSocketOpen(true)
        setErrorText("")
      })

      socket.addEventListener("message", (event) => {
        if (isDisposed || socketRef.current !== socket) {
          return
        }

        let message: TranslateWsServerMessage

        try {
          message = JSON.parse(event.data) as TranslateWsServerMessage
        } catch (error) {
          setIsTranslating(false)
          setErrorText("Invalid websocket response")
          return
        }

        if (message.type === "ready") {
          return
        }

        if (message.type === "translate.definitions.success") {
          if (message.requestId !== latestDefinitionsRequestIdRef.current) {
            return
          }

          writeDefinitionsToCache(message.definitions)
          const selectedWords = selectedOutputWordsRef.current
          setWordDefinitions(getCachedDefinitions(selectedWords))
          const missingWords = getMissingDefinitionWords(selectedWords)

          if (missingWords.length) {
            sendDefinitionsRequest(missingWords[0])
          } else {
            setIsDefinitionLoading(false)
          }
          return
        }

        if (
          message.type === "translate.error" &&
          message.requestId &&
          message.requestId === latestDefinitionsRequestIdRef.current
        ) {
          setWordDefinitions([])
          setIsDefinitionLoading(false)
          return
        }

        const latestRequestId = latestRequestRef.current.id
        const latestRequestInput = latestRequestRef.current.normalizedInputText
        const currentInput = currentNormalizedInputTextRef.current
        const isActiveCurrentRequest =
          !!latestRequestId &&
          !!latestRequestInput &&
          !!currentInput &&
          currentInput === latestRequestInput &&
          (!message.requestId || message.requestId === latestRequestId)

        if (!isActiveCurrentRequest) {
          return
        }

        setIsTranslating(false)

        if (message.type === "translate.success") {
          const selection = window.getSelection()
          if (selection) {
            selection.removeAllRanges()
          }

          console.log("got translation", message.words)

          setOutputWords(message.words)
          setSelectedOutputWords([])
          setWordDefinitions([])
          setIsDefinitionLoading(false)
          latestDefinitionsRequestIdRef.current = ""
          lastDefinitionRequestSignatureRef.current = ""
          setErrorText("")
          return
        }

        setErrorText(message.error || "Translation failed")
      })

      socket.addEventListener("error", () => {
        if (isDisposed || socketRef.current !== socket) {
          return
        }

        setIsSocketOpen(false)
      })

      socket.addEventListener("close", () => {
        if (socketRef.current === socket) {
          socketRef.current = null
        }

        if (isDisposed) {
          return
        }

        setIsSocketOpen(false)
        setIsTranslating(false)
        setIsDefinitionLoading(false)
        latestRequestRef.current = { id: "", normalizedInputText: "" }
        setLatestRequestSnapshot(latestRequestRef.current)
        currentNormalizedInputTextRef.current = ""
        lastRequestedSignatureRef.current = ""
        latestDefinitionsRequestIdRef.current = ""
        lastDefinitionRequestSignatureRef.current = ""
        reconnectTimeoutIdRef.current = window.setTimeout(() => {
          connectSocket()
        }, 500)
      })
    }

    connectSocket()

    return () => {
      isDisposed = true
      clearReconnectTimeout()

      const socket = socketRef.current
      socketRef.current = null
      setIsSocketOpen(false)

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close()
      } else if (socket) {
        socket.close()
      }
    }
  }, [])

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
    currentNormalizedInputTextRef.current = normalizedInputText

    if (!trimmedText) {
      setOutputWords([])
      setSelectedOutputWords([])
      setWordDefinitions([])
      setIsDefinitionLoading(false)
      setErrorText("")
      setDebouncedRequest(null)
      latestRequestRef.current = { id: "", normalizedInputText: "" }
      setLatestRequestSnapshot(latestRequestRef.current)
      lastRequestedSignatureRef.current = ""
      latestDefinitionsRequestIdRef.current = ""
      lastDefinitionRequestSignatureRef.current = ""
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
      latestRequestRef.current = { id: "", normalizedInputText: "" }
      setLatestRequestSnapshot(latestRequestRef.current)
      lastRequestedSignatureRef.current = ""
      latestDefinitionsRequestIdRef.current = ""
      lastDefinitionRequestSignatureRef.current = ""
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

    const nextSignature = getRequestSignature(debouncedRequest)

    if (lastRequestedSignatureRef.current === nextSignature) {
      return
    }

    sendTranslateRequest(debouncedRequest)
  }, [debouncedRequest, isSocketOpen])

  useEffect(() => {
    if (!selectedOutputWords.length) {
      setWordDefinitions([])
      setIsDefinitionLoading(false)
      latestDefinitionsRequestIdRef.current = ""
      lastDefinitionRequestSignatureRef.current = ""
      return
    }

    const uniqueWords = Array.from(new Set(selectedOutputWords))
    const cachedDefinitions = getCachedDefinitions(uniqueWords)
    setWordDefinitions(cachedDefinitions)

    const missingWords = getMissingDefinitionWords(uniqueWords)

    if (!missingWords.length) {
      setIsDefinitionLoading(false)
      latestDefinitionsRequestIdRef.current = ""
      lastDefinitionRequestSignatureRef.current = ""
      return
    }

    if (!isSocketOpen) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      sendDefinitionsRequest(missingWords[0])
    }, 200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [selectedOutputWords, isSocketOpen, selectedModel, targetLanguage])

  const definitionByWord = new Map(
    wordDefinitions.map((entry) => [normalizeDefinitionWord(entry.word), entry.definition])
  )
  const transliterationByWord = new Map<string, string>()

  outputWords
    .filter(({ punctuation }) => !punctuation)
    .forEach(({ word, literal }) => {
      const normalizedWord = normalizeDefinitionWord(word)
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
      <img src="piggo.svg" alt="" aria-hidden="true" className="title-icon fade-in" /> 
      <h1>
        Piggo Translate
      </h1>

      {/* <TranslateToolbar
        errorText={errorText}
        languageOptions={languageOptions}
        targetLanguage={targetLanguage}
        onLanguageSelect={(language) => {
          setTargetLanguage(language)
        }}
      /> */}

      <section className="pane-stack" aria-label="Translator workspace">
        {!isSocketOpen && isConnectionDotDelayComplete ? (
          <span className="pane-stack-connection-dot fade-in" aria-hidden="true" />
        ) : null}

        <TextPane
          id="input-pane-title"
          title="Input"
          showHeader={false}
          className="fade-in"
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
            onSelectionChange={(selectionWords) => {
              setSelectedOutputWords(selectionWords)
            }}
          />
        ) : null}

        {selectedOutputWords.map((word, index) => {
          const normalizedWord = normalizeDefinitionWord(word)
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

      <span className="app-version" aria-label="App version">
        v0.1.4
      </span>
    </main>
  )
}

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Missing root div with id 'root'")
}

createRoot(rootElement).render(<App />)
