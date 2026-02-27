import { Model, WsDefinitionsRequest, WsRequest, WsServerMessage, WordDefinition, WordToken } from "@template/core"
import { isLocal, normalizeDefinition } from "@template/web"

export type RequestSnapshot = {
  id: string
  normalizedInputText: string
}

export type TranslateRequestInput = {
  text: string
  targetLanguage: string
  model: Model
}

export type DefinitionsRequestInput = {
  word: string
  targetLanguage: string
  model: Model
}

export type ClientOptions = {
  onSocketOpenChange: (isOpen: boolean) => void
  onErrorTextChange: (errorText: string) => void
  onTranslatingChange: (isTranslating: boolean) => void
  onDefinitionLoadingChange: (isLoading: boolean) => void
  onLatestRequestChange: (snapshot: RequestSnapshot) => void
  onTranslateSuccess: (words: WordToken[]) => void
  onTranslateError: (errorText: string) => void
  onDefinitionsSuccess: (definitions: WordDefinition[]) => void
  onDefinitionsError: () => void
}

export type Client = {
  connect: () => void
  dispose: () => void
  setCurrentNormalizedInputText: (normalizedInputText: string) => void
  clearAllRequestState: () => void
  clearDefinitionRequestState: () => void
  sendTranslateRequest: (requestInput: TranslateRequestInput) => void
  sendDefinitionsRequest: (requestInput: DefinitionsRequestInput) => void
}

const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim()

const getTranslateWsUrl = () => {
  return isLocal() ? "http://localhost:5001/api/ws" : "https://piggo-translate-production.up.railway.app/api/ws"
}

const getRequestSignature = ({ text, targetLanguage, model }: { text: string, targetLanguage: string, model: Model }) => {
  return `${model}::${normalizeText(text)}::${targetLanguage}`
}

const getDefinitionRequestSignature = (word: string, targetLanguage: string, model: Model) => {
  return `${model}::${targetLanguage}::${normalizeDefinition(word)}`
}

export const Client = (options: ClientOptions): Client => {
  let socket: WebSocket | null = null
  let reconnectTimeoutId: number | null = null
  let isDisposed = false
  let requestCounter = 0
  let latestRequest: RequestSnapshot = {
    id: "",
    normalizedInputText: ""
  }
  let currentNormalizedInputText = ""
  let lastRequestedSignature = ""
  let latestDefinitionsRequestId = ""
  let lastDefinitionRequestSignature = ""

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutId === null) {
      return
    }

    window.clearTimeout(reconnectTimeoutId)
    reconnectTimeoutId = null
  }

  const clearDefinitionRequestState = () => {
    latestDefinitionsRequestId = ""
    lastDefinitionRequestSignature = ""
  }

  const clearAllRequestState = () => {
    latestRequest = { id: "", normalizedInputText: "" }
    options.onLatestRequestChange(latestRequest)
    currentNormalizedInputText = ""
    lastRequestedSignature = ""
    clearDefinitionRequestState()
  }

  const sendTranslateRequest = (requestInput: TranslateRequestInput) => {
    if (!requestInput.text || !socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    const requestSignature = getRequestSignature(requestInput)

    if (lastRequestedSignature === requestSignature) {
      return
    }

    requestCounter += 1
    const requestId = `${Date.now()}-${requestCounter}`

    options.onErrorTextChange("")
    options.onTranslatingChange(true)
    latestRequest = {
      id: requestId,
      normalizedInputText: normalizeText(requestInput.text)
    }
    options.onLatestRequestChange(latestRequest)
    lastRequestedSignature = requestSignature

    const request: WsRequest = {
      type: "translate.request",
      requestId,
      text: requestInput.text,
      targetLanguage: requestInput.targetLanguage,
      model: requestInput.model
    }

    socket.send(JSON.stringify(request))
  }

  const sendDefinitionsRequest = (requestInput: DefinitionsRequestInput) => {
    const normalizedWord = normalizeDefinition(requestInput.word)

    if (!normalizedWord || !socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    const requestSignature = getDefinitionRequestSignature(
      normalizedWord,
      requestInput.targetLanguage,
      requestInput.model
    )

    if (lastDefinitionRequestSignature === requestSignature) {
      return
    }

    requestCounter += 1
    const requestId = `${Date.now()}-${requestCounter}`
    latestDefinitionsRequestId = requestId
    lastDefinitionRequestSignature = requestSignature
    options.onDefinitionLoadingChange(true)

    const request: WsDefinitionsRequest = {
      type: "translate.definitions.request",
      requestId,
      word: normalizedWord,
      targetLanguage: requestInput.targetLanguage,
      model: requestInput.model
    }

    socket.send(JSON.stringify(request))
  }

  const connectSocket = () => {
    clearReconnectTimeout()

    const nextSocket = new WebSocket(getTranslateWsUrl())
    console.log("Connecting to websocket at", getTranslateWsUrl())
    socket = nextSocket
    options.onSocketOpenChange(false)

    nextSocket.addEventListener("open", () => {
      if (isDisposed || socket !== nextSocket) {
        return
      }

      options.onSocketOpenChange(true)
      options.onErrorTextChange("")
    })

    nextSocket.addEventListener("message", (event) => {
      if (isDisposed || socket !== nextSocket) {
        return
      }

      let message: WsServerMessage

      try {
        message = JSON.parse(event.data) as WsServerMessage
      } catch (error) {
        options.onTranslatingChange(false)
        options.onErrorTextChange("Invalid websocket response")
        return
      }

      if (message.type === "ready") {
        return
      }

      if (message.type === "translate.definitions.success") {
        if (message.requestId !== latestDefinitionsRequestId) {
          return
        }

        options.onDefinitionsSuccess(message.definitions)
        return
      }

      if (
        message.type === "translate.error" &&
        message.requestId &&
        message.requestId === latestDefinitionsRequestId
      ) {
        options.onDefinitionsError()
        return
      }

      const isActiveCurrentRequest =
        !!latestRequest.id &&
        !!latestRequest.normalizedInputText &&
        !!currentNormalizedInputText &&
        currentNormalizedInputText === latestRequest.normalizedInputText &&
        (!message.requestId || message.requestId === latestRequest.id)

      if (!isActiveCurrentRequest) {
        return
      }

      options.onTranslatingChange(false)

      if (message.type === "translate.success") {
        options.onTranslateSuccess(message.words)
        options.onErrorTextChange("")
        return
      }

      if (message.type === "translate.error") {
        options.onTranslateError(message.error || "Translation failed")
      }
    })

    nextSocket.addEventListener("error", () => {
      if (isDisposed || socket !== nextSocket) {
        return
      }

      options.onSocketOpenChange(false)
    })

    nextSocket.addEventListener("close", () => {
      if (socket === nextSocket) {
        socket = null
      }

      if (isDisposed) {
        return
      }

      options.onSocketOpenChange(false)
      options.onTranslatingChange(false)
      options.onDefinitionLoadingChange(false)
      clearAllRequestState()
      reconnectTimeoutId = window.setTimeout(() => {
        connectSocket()
      }, 500)
    })
  }

  const connect = () => {
    isDisposed = false
    connectSocket()
  }

  const dispose = () => {
    isDisposed = true
    clearReconnectTimeout()
    const activeSocket = socket
    socket = null
    options.onSocketOpenChange(false)

    if (activeSocket) {
      activeSocket.close()
    }
  }

  return {
    connect,
    dispose,
    setCurrentNormalizedInputText: (normalizedInputText: string) => {
      currentNormalizedInputText = normalizedInputText
    },
    clearAllRequestState,
    clearDefinitionRequestState,
    sendTranslateRequest,
    sendDefinitionsRequest
  }
}
