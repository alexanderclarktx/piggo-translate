import type { Translator } from "./Translator"

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

    if (!structuredTranslation.translation) {
      throw new Error("Anthropic returned an empty translation")
    }

    return structuredTranslation
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
    translation,
    transliteration
  }
}
