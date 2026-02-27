type TranslateModel = "openai" | "anthropic"

type TranslateWsRequestMessage = {
  type: "translate.request"
  requestId: string
  text: string
  targetLanguage: string
  model?: TranslateModel
}

type TranslateWsReadyMessage = {
  type: "ready"
}

type TranslateWsSuccessMessage = {
  type: "translate.success"
  requestId: string
  words: string[]
  transliteration: string
}

type TranslateWsErrorMessage = {
  type: "translate.error"
  requestId?: string
  error: string
}

type TranslateWsClientMessage = TranslateWsRequestMessage

type TranslateWsServerMessage =
  | TranslateWsReadyMessage
  | TranslateWsSuccessMessage
  | TranslateWsErrorMessage

export type {
  TranslateModel,
  TranslateWsClientMessage,
  TranslateWsErrorMessage,
  TranslateWsRequestMessage,
  TranslateWsServerMessage,
  TranslateWsSuccessMessage
}
