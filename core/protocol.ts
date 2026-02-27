type TranslateModel = "openai" | "anthropic"

type TranslateWordToken = {
  word: string
  literal: string
  punctuation: boolean
}

type TranslateWsRequestMessage = {
  type: "translate.request"
  requestId: string
  text: string
  targetLanguage: string
  model?: TranslateModel
}

type TranslateWordDefinition = {
  word: string
  definition: string
}

type TranslateWsDefinitionsRequestMessage = {
  type: "translate.definitions.request"
  requestId: string
  word: string
  targetLanguage: string
  model?: TranslateModel
}

type TranslateWsReadyMessage = {
  type: "ready"
}

type TranslateWsSuccessMessage = {
  type: "translate.success"
  requestId: string
  words: TranslateWordToken[]
}

type TranslateWsDefinitionsSuccessMessage = {
  type: "translate.definitions.success"
  requestId: string
  definitions: TranslateWordDefinition[]
}

type TranslateWsErrorMessage = {
  type: "translate.error"
  requestId?: string
  error: string
}

type TranslateWsClientMessage =
  | TranslateWsRequestMessage
  | TranslateWsDefinitionsRequestMessage

type TranslateWsServerMessage =
  | TranslateWsReadyMessage
  | TranslateWsSuccessMessage
  | TranslateWsDefinitionsSuccessMessage
  | TranslateWsErrorMessage

export type {
  TranslateModel,
  TranslateWordToken,
  TranslateWordDefinition,
  TranslateWsClientMessage,
  TranslateWsDefinitionsRequestMessage,
  TranslateWsDefinitionsSuccessMessage,
  TranslateWsErrorMessage,
  TranslateWsRequestMessage,
  TranslateWsServerMessage,
  TranslateWsSuccessMessage
}
