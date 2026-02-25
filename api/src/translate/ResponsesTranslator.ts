type OpenAiResponsesApiError = {
  error?: {
    message?: string
  }
}

type OpenAiResponsesOutputContent = {
  type?: string
  text?: string
}

type OpenAiResponsesOutputItem = {
  type?: string
  content?: OpenAiResponsesOutputContent[]
}

type OpenAiResponsesResponse = {
  output_text?: string
  output?: OpenAiResponsesOutputItem[]
  error?: {
    message?: string
  }
}

type TranslationStructuredOutput = {
  translation: string
  transliteration: string
}

export type ResponsesTranslator = {
  translate: (
    text: string,
    targetLanguage: string
  ) => Promise<TranslationStructuredOutput>
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

const getStructuredJsonText = (data: OpenAiResponsesResponse) => {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim()
  }

  const rawJson = data.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text || "")
    .join("")
    .trim()

  if (!rawJson) {
    throw new Error("OpenAI Responses API returned an empty structured response")
  }

  return rawJson
}

const parseStructuredTranslation = (rawJson: string) => {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error("OpenAI Responses API returned invalid structured JSON")
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
    throw new Error("OpenAI structured response missing 'translation'")
  }

  if (!transliteration) {
    throw new Error("OpenAI structured response missing 'transliteration'")
  }

  return {
    translation,
    transliteration
  } satisfies TranslationStructuredOutput
}

const getDefaultModel = () => {
  const configuredModel = process.env.OPENAI_RESPONSES_MODEL || process.env.OPENAI_MODEL

  if (!configuredModel || configuredModel === "gpt-realtime") {
    return "gpt-4.1-nano"
  }

  return configuredModel
}

const createTranslate =
  (): ResponsesTranslator["translate"] => async (text, targetLanguage) => {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY")
    }

    const model = getDefaultModel()
    const requestStartedAt = performance.now()
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 256,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are a translation engine. Translate accurately and preserve meaning, tone, and formatting where possible."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  `Translate the following text to ${targetLanguage}.\n` +
                  "Return a translation and a transliteration.\n" +
                  "The transliteration must be the pronunciation of the translated text written using the source input's alphabet/script.\n\n" +
                  text
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "translation_output",
            schema: translationOutputSchema,
            strict: true
          }
        }
      })
    })
    const responseDurationMs = performance.now() - requestStartedAt
    console.log(
      `[openai responses] response received in ${responseDurationMs}ms (status ${response.status.toFixed(0)}, model ${model})`
    )

    const data = (await response.json()) as
      | OpenAiResponsesResponse
      | OpenAiResponsesApiError

    if (!response.ok) {
      throw new Error(data.error?.message || "OpenAI Responses API request failed")
    }

    const structuredTranslation = parseStructuredTranslation(
      getStructuredJsonText(data as OpenAiResponsesResponse)
    )

    if (!structuredTranslation.translation) {
      throw new Error("OpenAI returned an empty translation")
    }

    return structuredTranslation
  }

export const ResponsesTranslator = (): ResponsesTranslator => {
  return {
    translate: createTranslate()
  }
}
