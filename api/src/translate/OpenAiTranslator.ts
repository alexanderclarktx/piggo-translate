import { Translator } from "./Translator"

type OpenAiRealtimeServerEvent = {
  type?: string
  delta?: string
  text?: string
  error?: {
    message?: string
  }
  response?: {
    status?: string
    status_details?: {
      error?: {
        message?: string
      }
    }
    output?: {
      content?: {
        type?: string
        text?: string
      }[]
    }[]
  }
}

type TranslationStructuredOutput = {
  words: string[]
  transliteration: string
}

export const OpenAiTranslator = (): Translator => ({
  translate: async (text, targetLanguage) => {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY")
    }

    const model =
      process.env.OPENAI_REALTIME_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-realtime"
    const timeoutMs = Number(process.env.OPENAI_REALTIME_TIMEOUT_MS || "30000")
    const requestStartedAt = performance.now()

    return await new Promise<TranslationStructuredOutput>((resolve, reject) => {
      let isSettled = false
      let streamedText = ""
      let receivedDoneEvent = false
      let ws: WebSocket

      const settleError = (error: unknown) => {
        if (isSettled) {
          return
        }

        isSettled = true
        clearTimeout(timeout)
        reject(error instanceof Error ? error : new Error("OpenAI request failed"))
      }

      const settleSuccess = (rawText: string) => {
        if (isSettled) {
          return
        }

        try {
          const structuredTranslation = parseStructuredTranslation(rawText)
          const responseDurationMs = performance.now() - requestStartedAt
          console.log(
            `[openai] response received in ${responseDurationMs.toFixed(0)}ms (model ${model})`
          )

          isSettled = true
          clearTimeout(timeout)
          resolve(structuredTranslation)
        } catch (error) {
          settleError(error)
        }
      }

      const timeout = setTimeout(() => {
        settleError(new Error(`OpenAI realtime request timed out after ${timeoutMs}ms`))
        ws.close()
      }, timeoutMs)

      ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
        // @ts-expect-error
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "OpenAI-Beta": "realtime=v1"
        }
      })

      ws.addEventListener("open", () => {
        ws.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildTranslationPrompt(text, targetLanguage)
                }
              ]
            }
          })
        )

        ws.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["text"],
              max_output_tokens: 1024,
              instructions:
                "You are a translation engine. Translate accurately and preserve meaning, tone, and formatting where possible."
            }
          })
        )
      })

      ws.addEventListener("message", (event) => {
        let parsedEvent: OpenAiRealtimeServerEvent

        try {
          if (typeof event.data !== "string") {
            const messageText =
              event.data instanceof Uint8Array
                ? Buffer.from(event.data).toString("utf8")
                : String(event.data)

            parsedEvent = JSON.parse(messageText) as OpenAiRealtimeServerEvent
          } else {
            parsedEvent = JSON.parse(event.data) as OpenAiRealtimeServerEvent
          }
        } catch {
          return
        }

        if (parsedEvent.type === "error") {
          settleError(
            new Error(parsedEvent.error?.message || "OpenAI realtime request failed")
          )
          ws.close()
          return
        }

        if (
          parsedEvent.type === "response.output_text.delta" &&
          typeof parsedEvent.delta === "string"
        ) {
          streamedText += parsedEvent.delta
          return
        }

        if (
          parsedEvent.type === "response.output_text.done" &&
          typeof parsedEvent.text === "string" &&
          !streamedText.trim()
        ) {
          streamedText = parsedEvent.text
          return
        }

        if (parsedEvent.type === "response.done") {
          receivedDoneEvent = true

          const failedStatus =
            parsedEvent.response?.status &&
            parsedEvent.response.status !== "completed"

          if (failedStatus) {
            settleError(
              new Error(
                parsedEvent.response?.status_details?.error?.message ||
                `OpenAI response ended with status '${parsedEvent.response?.status}'`
              )
            )
            ws.close()
            return
          }

          const doneText = getResponseTextFromDoneEvent(parsedEvent)
          settleSuccess(streamedText || doneText)
          ws.close()
        }
      })

      ws.addEventListener("error", () => {
        settleError(new Error("OpenAI realtime websocket error"))
      })

      ws.addEventListener("close", () => {
        if (!isSettled && !receivedDoneEvent) {
          settleError(new Error("OpenAI realtime websocket closed before completion"))
        }
      })
    })
  }
})

const parseStructuredTranslation = (rawText: string) => {
  const trimmed = rawText.trim()
  const jsonCandidate = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  if (!jsonCandidate) {
    throw new Error("OpenAI returned an empty structured response")
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(jsonCandidate)
  } catch {
    throw new Error("OpenAI returned invalid structured JSON")
  }

  const transliteration =
    parsed &&
      typeof parsed === "object" &&
      "transliteration" in parsed &&
      typeof parsed.transliteration === "string"
      ? parsed.transliteration.trim()
      : ""
  const words =
    parsed &&
      typeof parsed === "object" &&
      "words" in parsed &&
      Array.isArray(parsed.words)
      ? parsed.words.filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
      : []

  if (!transliteration) {
    throw new Error("OpenAI structured response missing 'transliteration'")
  }

  if (!words.length) {
    throw new Error("OpenAI structured response missing 'words'")
  }

  return {
    words,
    transliteration
  } satisfies TranslationStructuredOutput
}

const getResponseTextFromDoneEvent = (event: OpenAiRealtimeServerEvent) => {
  return (
    event.response?.output
      ?.flatMap((item) => item.content || [])
      .filter((content) => typeof content.text === "string")
      .map((content) => content.text || "")
      .join("")
      .trim() || ""
  )
}

const buildTranslationPrompt = (text: string, targetLanguage: string) => {
  return (
    `Translate the following text to ${targetLanguage}.\n` +
    "Return only a valid JSON object with exactly these keys:\n" +
    `{"words":["..."],"transliteration":"..."}\n` +
    "The words array must contain one translated word per item.\n" +
    "Attach punctuation to the nearest word so joining words with spaces reads naturally.\n" +
    "For Chinese output, each item must be a complete Chinese word (multi-character words are allowed and expected).\n" +
    "Do not include spaces or empty strings as array items.\n" +
    "The transliteration must be the pronunciation (or pinyin in the case of Chinese) of the translated text written using the source input's alphabet/script.\n" +
    "Do not include markdown, code fences, or explanations.\n\n" +
    text
  )
}
