import { formatUptime } from "@template/core"

type TranslateRequestBody = {
  text: string
  targetLanguage?: string
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
    typeof body.targetLanguage === "string" && body.targetLanguage.trim()
      ? body.targetLanguage.trim()
      : "Chinese (simplified)"

  return {
    text,
    targetLanguage
  }
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
        "You are a translation engine. Return only the translated text with no explanation.",
      messages: [
        {
          role: "user",
          content: `Translate the following text to ${targetLanguage}:\n\n${text}`
        }
      ]
    })
  })

  const data = (await response.json()) as AnthropicMessageResponse

  if (!response.ok) {
    throw new Error(data.error?.message || "Anthropic request failed")
  }

  const translatedText = data.content
    ?.filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text || "")
    .join("")
    .trim()

  if (!translatedText) {
    throw new Error("Anthropic returned an empty translation")
  }

  return translatedText
}

export const createApiServer = () => {
  const server = Bun.serve({
    port: 5001,
    async fetch(request) {
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
    }
  })

  console.log(`API server running at ${server.hostname}:${server.port}`)

  return server
}

createApiServer()
