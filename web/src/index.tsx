import { TranslateModel, TranslateWsRequestMessage, TranslateWsServerMessage } from "@template/core"
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
  return `http://${hostname}:5001/api/ws`
}

const App = () => {
  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [outputTransliteration, setOutputTransliteration] = useState("")
  const [isTransliterationVisible, setIsTransliterationVisible] = useState(true)
  const [errorText, setErrorText] = useState("")
  const [isTranslating, setIsTranslating] = useState(false)
  const [isSocketOpen, setIsSocketOpen] = useState(false)
  const [debouncedRequest, setDebouncedRequest] = useState<{
    text: string
    targetLanguage: string
    model: TranslateModel
  } | null>(null)
  const [targetLanguage, setTargetLanguage] = useState(languageOptions[1].value)
  const [selectedModel, setSelectedModel] = useState<TranslateModel>("openai")
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutIdRef = useRef<number | null>(null)
  const requestCounterRef = useRef(0)
  const latestRequestIdRef = useRef("")
  const lastRequestedSignatureRef = useRef("")

  const sendTranslateRequest = (requestInput: {
    text: string
    targetLanguage: string
    model: TranslateModel
  }) => {
    const socket = socketRef.current

    if (
      !requestInput.text ||
      isTranslating ||
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      return
    }

    requestCounterRef.current += 1
    const requestId = `${Date.now()}-${requestCounterRef.current}`

    setErrorText("")
    setIsTranslating(true)
    latestRequestIdRef.current = requestId
    lastRequestedSignatureRef.current =
      `${requestInput.model}::${requestInput.text}::${requestInput.targetLanguage}`

    const request: TranslateWsRequestMessage = {
      type: "translate.request",
      requestId,
      text: requestInput.text,
      targetLanguage: requestInput.targetLanguage,
      model: requestInput.model
    }

    console.log("Sending translate request", request)

    socket.send(JSON.stringify(request))
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

        if (
          message.requestId &&
          latestRequestIdRef.current &&
          message.requestId !== latestRequestIdRef.current
        ) {
          return
        }

        setIsTranslating(false)

        if (message.type === "translate.success") {
          setOutputText(message.text)
          setOutputTransliteration(message.transliteration)
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
        lastRequestedSignatureRef.current = ""
        reconnectTimeoutIdRef.current = window.setTimeout(() => {
          connectSocket()
        }, 500)
      })
    }

    if (window.location.hostname === "localhost") connectSocket()

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

  // if input changes
  useEffect(() => {
    const trimmedText = inputText.trim()

    if (!trimmedText) {
      setOutputText("")
      setOutputTransliteration("")
      setErrorText("")
      setDebouncedRequest(null)
      lastRequestedSignatureRef.current = ""
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
  }, [inputText])

  // if language changes
  useEffect(() => {
    const trimmedText = inputText.trim()

    if (!trimmedText) {
      setOutputText("")
      setOutputTransliteration("")
      setErrorText("")
      setDebouncedRequest(null)
      lastRequestedSignatureRef.current = ""
      return
    }

    setDebouncedRequest({
      text: trimmedText,
      targetLanguage,
      model: selectedModel
    })
  }, [targetLanguage])

  useEffect(() => {
    if (!debouncedRequest || !isSocketOpen || isTranslating) {
      return
    }

    const nextSignature =
      `${debouncedRequest.model}::${debouncedRequest.text}::${debouncedRequest.targetLanguage}`

    if (lastRequestedSignatureRef.current === nextSignature) {
      return
    }

    sendTranslateRequest(debouncedRequest)
  }, [debouncedRequest, isSocketOpen, isTranslating])

  return (
    <main>
      {/* <header>
        <h1>
          <span>Wordy</span>
          <img src="/favicon.svg" alt="" aria-hidden="true" className="title-icon" />
        </h1>
      </header> */}

      {/* <TranslateToolbar
        errorText={errorText}
        languageOptions={languageOptions}
        targetLanguage={targetLanguage}
        onLanguageSelect={(language) => {
          setTargetLanguage(language)
        }}
      /> */}

      <section className="pane-stack" aria-label="Translator workspace">
        <TextPane
          id="input-pane-title"
          title="Input"
          showHeader={false}
          placeholder=""
          ariaLabel="Text to translate"
          value={inputText}
          autoFocus
          onChange={setInputText}
          readOnly={false}
        />

        <TextPane
          id="output-pane-title"
          title="Translated Output"
          showHeader={false}
          placeholder="translation"
          ariaLabel="Translated text"
          value={outputText}
          autoFocus={false}
          footer={
            outputTransliteration ? (
              <Transliteration
                value={outputTransliteration}
                isVisible={isTransliterationVisible}
                onToggle={() => setIsTransliterationVisible((value) => !value)}
              />
            ) : null
          }
          readOnly
        />

        {isTranslating ? (
          <span className="spinner pane-stack-spinner" aria-hidden="true" />
        ) : null}
      </section>

      {/* <div className="pane-switch-row" aria-label="Model selection">
        <ModelSwitch
          className="output-pane-model-switch"
          selectedModel={selectedModel}
          onModelToggle={setSelectedModel}
        />
      </div> */}
    </main>
  )
}

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("Missing root div with id 'root'")
}

createRoot(rootElement).render(<App />)
