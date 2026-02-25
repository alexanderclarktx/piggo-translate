import {
  formatUptime,
  type TranslateWsClientMessage,
  type TranslateWsServerMessage
} from "@template/core"

type TranslateRequestBody = {
  text: string
  targetLanguage: string
}

type AnthropicMessageContentBlock = {
  type: string
  text?: string
}

type AnthropicMessageResponse = {
  content?: AnthropicMessageContentBlock[]
  error?: {
    message?: string
  }
}

type TranslationStructuredOutput = {
  translation: string
}

const translationOutputSchema = {
  type: "object",
  properties: {
    translation: {
      type: "string",
      description: "The translated text only, with no explanation"
    }
  },
  required: ["translation"],
  additionalProperties: false
} as const

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
}

const createJsonResponse = (data: unknown, status = 200) => {
  return Response.json(data, {
    status,
    headers: corsHeaders
  })
}

const createTextResponse = (text: string, status = 200) => {
  return new Response(text, {
    status,
    headers: corsHeaders
  })
}

const sendWsMessage = (
  ws: Bun.ServerWebSocket<undefined>,
  message: TranslateWsServerMessage
) => {
  ws.send(JSON.stringify(message))
}

const logServerError = (context: string, error: unknown) => {
  if (error instanceof Error) {
    console.error(`[api] ${context}: ${error.message}`)

    if (error.stack) {
      console.error(error.stack)
    }

    return
  }

  console.error(`[api] ${context}:`, error)
}

const parseTranslateRequest = async (request: Request) => {
  const body = (await request.json()) as Partial<TranslateRequestBody>
  const text = typeof body.text === "string" ? body.text.trim() : ""
  const targetLanguage =
    typeof body.targetLanguage === "string" ? body.targetLanguage.trim() : ""

  return {
    text,
    targetLanguage
  }
}

const normalizeTranslateInput = (
  text: unknown,
  targetLanguage: unknown
) => {
  const normalizedText = typeof text === "string" ? text.trim() : ""
  const normalizedTargetLanguage =
    typeof targetLanguage === "string" ? targetLanguage.trim() : ""

  return {
    text: normalizedText,
    targetLanguage: normalizedTargetLanguage
  }
}

const parseTranslateWsMessage = (
  rawMessage: unknown
):
  | {
      error: string
    }
  | {
      requestId: string
      text: string
      targetLanguage: string
    } => {
  if (!rawMessage || typeof rawMessage !== "object") {
    return {
      error: "Invalid websocket message"
    }
  }

  const message = rawMessage as Partial<TranslateWsClientMessage>

  if (message.type !== "translate.request") {
    return {
      error: "Unsupported websocket message type"
    }
  }

  if (typeof message.requestId !== "string" || !message.requestId.trim()) {
    return {
      error: "Websocket message must include a non-empty 'requestId' string"
    }
  }

  const { text, targetLanguage } = normalizeTranslateInput(
    message.text,
    message.targetLanguage
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
    requestId: message.requestId.trim(),
    text,
    targetLanguage
  }
}

const parseWsJsonMessage = (message: string | Uint8Array | Buffer) => {
  const rawText =
    typeof message === "string" ? message : Buffer.from(message).toString("utf8")

  return JSON.parse(rawText)
}

const parseStructuredTranslation = (content?: AnthropicMessageContentBlock[]) => {
  const rawJson = content
    ?.filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text || "")
    .join("")
    .trim()

  if (!rawJson) {
    throw new Error("Anthropic returned an empty structured response")
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error("Anthropic returned invalid structured JSON")
  }

  const translation =
    parsed &&
    typeof parsed === "object" &&
    "translation" in parsed &&
    typeof parsed.translation === "string"
      ? parsed.translation.trim()
      : ""

  if (!translation) {
    throw new Error("Anthropic structured response missing 'translation'")
  }

  return {
    translation
  } satisfies TranslationStructuredOutput
}

const translateWithAnthropic = async (text: string, targetLanguage: string) => {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY")
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6"
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 64,
      system:
        "You are a translation engine. Translate accurately and preserve meaning, tone, and formatting where possible.",
      messages: [
        {
          role: "user",
          content: `Translate the following text to ${targetLanguage}:\n\n${text}`
        }
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: translationOutputSchema
        }
      }
    })
  })

  const data = (await response.json()) as AnthropicMessageResponse

  if (!response.ok) {
    throw new Error(data.error?.message || "Anthropic request failed")
  }

  const translatedText = parseStructuredTranslation(data.content).translation

  if (!translatedText) {
    throw new Error("Anthropic returned an empty translation")
  }

  return translatedText
}

export const createApiServer = () => {
  const server = Bun.serve({
    port: 5001,
    async fetch(request, serverInstance) {
      const url = new URL(request.url)

      if (request.method === "OPTIONS") {
        return createTextResponse("", 204)
      }

      if (url.pathname === "/api") {
        return createJsonResponse({
          status: "ok",
          uptime: formatUptime(process.uptime())
        })
      }

      if (url.pathname === "/api/ws") {
        const upgraded = serverInstance.upgrade(request)

        if (upgraded) {
          return
        }

        return createTextResponse("WebSocket upgrade failed", 400)
      }

      if (url.pathname === "/api/translate" && request.method === "POST") {
        try {
          const { text, targetLanguage } = await parseTranslateRequest(request)

          if (!text) {
            return createJsonResponse(
              {
                error: "Request body must include a non-empty 'text' string"
              },
              400
            )
          }

          if (!targetLanguage) {
            return createJsonResponse(
              {
                error:
                  "Request body must include a non-empty 'targetLanguage' string"
              },
              400
            )
          }

          const translatedText = await translateWithAnthropic(text, targetLanguage)

          return createJsonResponse({
            text: translatedText
          })
        } catch (error) {
          logServerError(`${request.method} ${url.pathname}`, error)

          const message =
            error instanceof Error ? error.message : "Translation failed"

          return createJsonResponse(
            {
              error: message
            },
            500
          )
        }
      }

      return createTextResponse("Not Found", 404)
    },
    websocket: {
      open(ws) {
        sendWsMessage(ws, {
          type: "ready"
        })
      },
      async message(ws, message) {
        let parsedJson: unknown

        try {
          parsedJson = parseWsJsonMessage(message)
        } catch (error) {
          logServerError("WS parse", error)
          sendWsMessage(ws, {
            type: "translate.error",
            error: "Invalid JSON message"
          })
          return
        }

        const parsedMessage = parseTranslateWsMessage(parsedJson)

        if ("error" in parsedMessage) {
          sendWsMessage(ws, {
            type: "translate.error",
            error: parsedMessage.error
          })
          return
        }

        try {
          const translatedText = await translateWithAnthropic(
            parsedMessage.text,
            parsedMessage.targetLanguage
          )

          sendWsMessage(ws, {
            type: "translate.success",
            requestId: parsedMessage.requestId,
            text: translatedText
          })
        } catch (error) {
          logServerError(`WS translate ${parsedMessage.requestId}`, error)

          const messageText =
            error instanceof Error ? error.message : "Translation failed"

          sendWsMessage(ws, {
            type: "translate.error",
            requestId: parsedMessage.requestId,
            error: messageText
          })
        }
      }
    }
  })

  console.log(`API server running at ${server.hostname}:${server.port}`)

  return server
}

createApiServer()
