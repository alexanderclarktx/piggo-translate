import { Model } from "@template/core"
import { httpJson, httpText } from "./utils/HttpUtils"
import { OpenAiTranslator } from "./translate/OpenAiTranslator"

const logServerError = (context: string, error: unknown) => {
  if (error instanceof Error) {
    console.error(`[api] ${context}: ${error.message}`)

    if (error.stack) console.error(error.stack)

    return
  }

  console.error(`[api] ${context}:`, error)
}

const normalizeTranslateInput = (
  text: unknown,
  targetLanguage: unknown,
  model?: unknown
) => {
  const normalizedText = typeof text === "string" ? text.trim() : ""
  const normalizedTargetLanguage =
    typeof targetLanguage === "string" ? targetLanguage.trim() : ""
  const normalizedModel: Model =
    model === "anthropic" ? "anthropic" : "openai"

  return {
    text: normalizedText,
    targetLanguage: normalizedTargetLanguage,
    model: normalizedModel
  }
}

const parseTranslateWsMessage = (rawMessage: unknown): { error: string } | ({
  type: "translate.request"
  requestId: string
  text: string
  targetLanguage: string
  model: Model
} | {
  type: "translate.definitions.request"
  requestId: string
  word: string
  context: string
  targetLanguage: string
  model: Model
} | {
  type: "translate.audio.request"
  requestId: string
  text: string
  model: Model
}) => {
  if (!rawMessage || typeof rawMessage !== "object") {
    return {
      error: "Invalid websocket message"
    }
  }

  const message = rawMessage as {
    type?: string
    requestId?: unknown
    text?: unknown
    targetLanguage?: unknown
    model?: unknown
    word?: unknown
    context?: unknown
  }

  if (
    message.type !== "translate.request" &&
    message.type !== "translate.definitions.request" &&
    message.type !== "translate.audio.request"
  ) {
    return {
      error: "Unsupported websocket message type"
    }
  }

  if (typeof message.requestId !== "string" || !message.requestId.trim()) {
    return {
      error: "Websocket message must include a non-empty 'requestId' string"
    }
  }

  if (message.type === "translate.request") {
    const { text, targetLanguage } = normalizeTranslateInput(
      message.text,
      message.targetLanguage,
      message.model
    )

    if (!text) {
      return {
        error: "Websocket message must include a non-empty 'text' string"
      }
    }

    if (!targetLanguage) {
      return {
        error: "Websocket message must include a non-empty 'targetLanguage' string"
      }
    }

    return {
      type: "translate.request",
      requestId: message.requestId.trim(),
      text,
      targetLanguage,
      model: message.model === "anthropic" ? "anthropic" : "openai"
    }
  }

  if (message.type === "translate.audio.request") {
    const text = typeof message.text === "string" ? message.text.trim() : ""

    if (!text) {
      return {
        error: "Websocket message must include a non-empty 'text' string"
      }
    }

    return {
      type: "translate.audio.request",
      requestId: message.requestId.trim(),
      text,
      model: message.model === "anthropic" ? "anthropic" : "openai"
    }
  }

  const word = typeof message.word === "string" ? message.word.trim() : ""
  const context = typeof message.context === "string" ? message.context.trim() : ""
  const normalizedTargetLanguage =
    typeof message.targetLanguage === "string" ? message.targetLanguage.trim() : ""

  if (!word) {
    return {
      error: "Websocket message must include a non-empty 'word' string"
    }
  }

  if (!normalizedTargetLanguage) {
    return {
      error: "Websocket message must include a non-empty 'targetLanguage' string"
    }
  }

  if (!context) {
    return {
      error: "Websocket message must include a non-empty 'context' string"
    }
  }

  return {
    type: "translate.definitions.request",
    requestId: message.requestId.trim(),
    word,
    context,
    targetLanguage: normalizedTargetLanguage,
    model: message.model === "anthropic" ? "anthropic" : "openai"
  }
}

const parseWsJsonMessage = (message: string | Uint8Array | Buffer) => {
  const rawText =
    typeof message === "string" ? message : Buffer.from(message).toString("utf8")

  return JSON.parse(rawText)
}

export const createApiServer = () => {

  // const anthropicTranslator = AnthropicTranslator()
  const openAiTranslator = OpenAiTranslator()

  const translateWithModel = async (model: Model, text: string, targetLanguage: string) => {
    const translator = model === "anthropic" ? openAiTranslator : openAiTranslator

    return translator.translate(text, targetLanguage)
  }

  const getDefinitionsWithModel = async (model: Model, word: string, targetLanguage: string, context: string) => {
    const translator = model === "anthropic" ? openAiTranslator : openAiTranslator

    return translator.getDefinitions(word, targetLanguage, context)
  }

  const getAudioWithModel = async (model: Model, text: string) => {
    const translator = model === "anthropic" ? openAiTranslator : openAiTranslator

    return translator.getAudio(text)
  }

  const server = Bun.serve({
    port: 5001,
    async fetch(request, serverInstance) {
      const url = new URL(request.url)

      if (request.method === "OPTIONS") {
        return httpText("", 204)
      }

      if (url.pathname === "/api") {
        return httpJson({
          status: "ok"
        })
      }

      if (url.pathname === "/api/ws") {
        const upgraded = serverInstance.upgrade(request)
        if (upgraded) return

        return httpText("WebSocket upgrade failed", 400)
      }

      return httpText("Not Found", 404)
    },
    websocket: {
      open(ws) {
        ws.send(JSON.stringify({ type: "ready" }))
      },
      async message(ws, message) {
        let parsedJson: unknown

        try {
          parsedJson = parseWsJsonMessage(message)
        } catch (error) {
          logServerError("WS parse", error)

          ws.send(JSON.stringify({
            type: "translate.error",
            error: "Invalid JSON message"
          }))
          return
        }

        const parsedMessage = parseTranslateWsMessage(parsedJson)

        if ("error" in parsedMessage) {
          ws.send(JSON.stringify({
            type: "translate.error",
            error: parsedMessage.error
          }))
          return
        }

        if (parsedMessage.type === "translate.request") {
          try {
            const translatedOutput = await translateWithModel(
              parsedMessage.model,
              parsedMessage.text,
              parsedMessage.targetLanguage
            )

            ws.send(JSON.stringify({
              type: "translate.success",
              requestId: parsedMessage.requestId,
              words: translatedOutput.words
            }))
          } catch (error) {
            logServerError(`WS translate ${parsedMessage.requestId}`, error)

            const messageText =
              error instanceof Error ? error.message : "Translation failed"

            ws.send(JSON.stringify({
              type: "translate.error",
              requestId: parsedMessage.requestId,
              error: messageText
            }))
          }

          return
        }

        if (parsedMessage.type === "translate.audio.request") {
          try {
            const audioBlob = await getAudioWithModel(
              parsedMessage.model,
              parsedMessage.text
            )
            const audioBuffer = Buffer.from(await audioBlob.arrayBuffer())

            ws.send(JSON.stringify({
              type: "translate.audio.success",
              requestId: parsedMessage.requestId,
              audioBase64: audioBuffer.toString("base64"),
              mimeType: audioBlob.type || "audio/pcm"
            }))
          } catch (error) {
            logServerError(`WS audio ${parsedMessage.requestId}`, error)

            const messageText =
              error instanceof Error ? error.message : "Text-to-speech failed"

            ws.send(JSON.stringify({
              type: "translate.error",
              requestId: parsedMessage.requestId,
              error: messageText
            }))
          }

          return
        }

        try {
          const definitions = await getDefinitionsWithModel(
            parsedMessage.model,
            parsedMessage.word,
            parsedMessage.targetLanguage,
            parsedMessage.context
          )

          ws.send(JSON.stringify({
            type: "translate.definitions.success",
            requestId: parsedMessage.requestId,
            definitions
          }))
        } catch (error) {
          logServerError(`WS definitions ${parsedMessage.requestId}`, error)

          const messageText =
            error instanceof Error ? error.message : "Definition lookup failed"

          ws.send(JSON.stringify({
            type: "translate.error",
            requestId: parsedMessage.requestId,
            error: messageText
          }))
        }
      }
    }
  })

  console.log(`API server running at ${server.hostname}:${server.port}`)

  return server
}

createApiServer()
