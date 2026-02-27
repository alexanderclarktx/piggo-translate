import { Translator } from "./Translator"
import { TranslateWordDefinition } from "@template/core"

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

const translationOutputSchema = {
  type: "object",
  properties: {
    translation: {
      type: "string",
      description: "The translated text only, with no explanation"
    },
    transliteration: {
      type: "string",
      description:
        "Pronunciation of the translated text written in the source input alphabet/script"
    }
  },
  required: ["translation", "transliteration"],
  additionalProperties: false
} as const

const definitionOutputSchema = {
  type: "object",
  properties: {
    definitions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: {
            type: "string"
          },
          definition: {
            type: "string"
          }
        },
        required: ["word", "definition"],
        additionalProperties: false
      }
    }
  },
  required: ["definitions"],
  additionalProperties: false
} as const

export const AnthropicTranslator = (): Translator => ({
  translate: async (text, targetLanguage) => {
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY")
    }

    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5" // "claude-sonnet-4-6"
    const requestStartedAt = performance.now()
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        system:
          "You are a translation engine. Translate accurately and preserve meaning, tone, and formatting where possible. Return valid JSON matching the schema.",
        messages: [
          {
            role: "user",
            content:
              `Translate the following text to ${targetLanguage}.\n` +
              "Also provide a transliteration: the pronunciation of the translated output written using the input text's alphabet/script.\n\n" +
              text
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
    const responseDurationMs = performance.now() - requestStartedAt
    console.log(`[anthropic] response received in ${responseDurationMs}ms (status ${response.status.toFixed(0)})`)

    const data = (await response.json()) as AnthropicMessageResponse

    if (!response.ok) {
      throw new Error(data.error?.message || "Anthropic request failed")
    }

    const structuredTranslation = parseStructuredTranslation(data.content)

    return structuredTranslation
  },
  getDefinitions: async (words, targetLanguage) => {
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY")
    }

    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5"
    const requestStartedAt = performance.now()
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 384,
        system:
          "You write concise dictionary-style definitions. Return valid JSON matching the schema.",
        messages: [
          {
            role: "user",
            content:
              `Write short English definitions for each word in this ${targetLanguage} list.\n` +
              "Keep each definition under 20 words.\n" +
              "Return a definition for every input word in the same order.\n\n" +
              words.join("\n")
          }
        ],
        output_config: {
          format: {
            type: "json_schema",
            schema: definitionOutputSchema
          }
        }
      })
    })
    const responseDurationMs = performance.now() - requestStartedAt
    console.log(`[anthropic] definitions received in ${responseDurationMs}ms (status ${response.status.toFixed(0)})`)

    const data = (await response.json()) as AnthropicMessageResponse

    if (!response.ok) {
      throw new Error(data.error?.message || "Anthropic definitions request failed")
    }

    return parseStructuredDefinitions(data.content, words)
  }
})

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
  const transliteration =
    parsed &&
      typeof parsed === "object" &&
      "transliteration" in parsed &&
      typeof parsed.transliteration === "string"
      ? parsed.transliteration.trim()
      : ""

  if (!translation) {
    throw new Error("Anthropic structured response missing 'translation'")
  }

  if (!transliteration) {
    throw new Error("Anthropic structured response missing 'transliteration'")
  }

  return {
    words: splitTranslationWords(translation),
    transliteration
  }
}

const splitTranslationWords = (translation: string) => {
  return translation.match(/[\p{Script=Han}]+|[^\s]+/gu) ?? [translation]
}

const parseStructuredDefinitions = (content: AnthropicMessageContentBlock[] | undefined, requestedWords: string[]) => {
  const rawJson = content
    ?.filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text || "")
    .join("")
    .trim()

  if (!rawJson) {
    throw new Error("Anthropic returned an empty structured definitions response")
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error("Anthropic returned invalid structured definitions JSON")
  }

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

  if (!normalizedDefinitions.length) {
    throw new Error("Anthropic structured definitions response missing 'definitions'")
  }

  const definitionByWord = new Map(normalizedDefinitions.map((item) => [item.word, item.definition]))

  return requestedWords.map((word) => ({
    word,
    definition: definitionByWord.get(word) || ""
  })).filter((item) => !!item.definition) satisfies TranslateWordDefinition[]
}
