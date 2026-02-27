import { Translator } from "./Translator"
import { TranslateWordDefinition } from "@template/core"

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
  transliteration: string[]
}

type DefinitionsStructuredOutput = {
  definitions: TranslateWordDefinition[]
}

export const OpenAiTranslator = (): Translator => ({
  translate: async (text, targetLanguage) => {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY")
    }

    const rawText = await runOpenAiRealtimeRequest(
      apiKey,
      buildTranslationPrompt(text, targetLanguage),
      "You are a translation engine. Translate accurately and preserve meaning, tone, and formatting where possible."
    )

    return parseStructuredTranslation(rawText)
  },
  getDefinitions: async (word, targetLanguage) => {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY")
    }

    const rawText = await runOpenAiRealtimeRequest(
      apiKey,
      buildDefinitionPrompt(word, targetLanguage),
      "You write concise dictionary-style definitions. Return valid JSON only."
    )

    return parseStructuredDefinitions(rawText, word).definitions
  }
})

const runOpenAiRealtimeRequest = async (
  apiKey: string,
  prompt: string,
  instructions: string
) => {
  const model =
    process.env.OPENAI_REALTIME_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-realtime"
  const timeoutMs = Number(process.env.OPENAI_REALTIME_TIMEOUT_MS || "30000")
  const requestStartedAt = performance.now()

  return await new Promise<string>((resolve, reject) => {
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

      const responseDurationMs = performance.now() - requestStartedAt
      console.log(
        `[openai] response received in ${responseDurationMs.toFixed(0)}ms (model ${model})`
      )

      isSettled = true
      clearTimeout(timeout)
      resolve(rawText)
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
                text: prompt
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
            instructions
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
    console.error(jsonCandidate)
    throw new Error("OpenAI returned invalid structured JSON")
  }

  const words =
    parsed &&
      typeof parsed === "object" &&
      "words" in parsed &&
      Array.isArray(parsed.words)
      ? parsed.words.filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
      : []
  const transliteration =
    parsed &&
      typeof parsed === "object" &&
      "transliteration" in parsed &&
      Array.isArray(parsed.transliteration)
      ? parsed.transliteration
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
      : []

  if (!transliteration.length) {
    throw new Error("OpenAI structured response missing 'transliteration'")
  }

  if (!words.length) {
    throw new Error("OpenAI structured response missing 'words'")
  }

  if (transliteration.length !== words.length) {
    console.error("transliteration length did not match words length", { transliteration, words })
    // throw new Error("OpenAI structured response must include one transliteration item per word")
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
    `{"words":["..."],"transliteration":["..."]}\n` +
    "The words array must contain one translated word per item.\n" +
    "Attach punctuation to the nearest word so joining words with spaces reads naturally.\n" +
    "For Chinese output, each item must be a complete Chinese word (multi-character words are allowed and expected).\n" +
    "Do not include spaces or empty strings as array items.\n" +
    "The transliteration array must include one pronunciation item for each output word, in the same order.\n" +
    "Each transliteration item must use the source input's alphabet/script (for Chinese, use pinyin).\n" +
    "Do not include markdown, code fences, or explanations.\n\n" +
    text
  )
}

const buildDefinitionPrompt = (word: string, targetLanguage: string) => {
  return (
    `Write short English definitions for the word "${word}" (language is ${targetLanguage}).\n` +
    "Return only valid JSON with exactly this shape:\n" +
    `{"definition":"..."}\n` +
    "Keep the definition under 20 words.\n" +
    "If the word is composed of multiple component words, break down each component.\n" +
    "Do not include the word itself in the definition.\n" +
    "Do not include markdown or code fences.\n\n"
  )
}

const parseStructuredDefinitions = (rawText: string, requestedWord: string) => {
  const trimmed = rawText.trim()
  const jsonCandidate = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  if (!jsonCandidate) {
    throw new Error("OpenAI returned an empty structured definitions response")
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(jsonCandidate)
  } catch {
    console.error(jsonCandidate)
    throw new Error("OpenAI returned invalid structured definitions JSON")
  }

  const parsedDefinitionText =
    parsed &&
      typeof parsed === "object" &&
      "definition" in parsed &&
      typeof parsed.definition === "string"
      ? parsed.definition.trim()
      : ""

  const parsedDefinitions =
    parsed &&
      typeof parsed === "object" &&
      "definitions" in parsed &&
      Array.isArray(parsed.definitions)
      ? parsed.definitions
      : []

  const normalizedDefinitions = parsedDefinitions
    .filter((value): value is { word?: unknown, definition?: unknown } => !!value && typeof value === "object")
    .map((value) => ({
      word: typeof value.word === "string" ? value.word.trim() : "",
      definition: typeof value.definition === "string" ? value.definition.trim() : ""
    }))
    .filter((value) => !!value.word && !!value.definition)

  if (!normalizedDefinitions.length && !parsedDefinitionText) {
    throw new Error("OpenAI structured definitions response missing 'definitions'")
  }

  const definitionByWord = new Map(normalizedDefinitions.map((item) => [item.word, item.definition]))
  const fallbackDefinition = parsedDefinitionText || definitionByWord.get(requestedWord) || ""
  const definitions = [{
    word: requestedWord,
    definition: fallbackDefinition
  }].filter((item) => !!item.definition)

  return {
    definitions
  } satisfies DefinitionsStructuredOutput
}
