type Model = "openai" | "anthropic"

type WordToken = {
  word: string
  literal: string
  punctuation: boolean
}

type WsRequest = {
  type: "translate.request"
  requestId: string
  text: string
  targetLanguage: string
  model?: Model
}

type WordDefinition = {
  word: string
  definition: string
}

type WsDefinitionsRequest = {
  type: "translate.definitions.request"
  requestId: string
  word: string
  targetLanguage: string
  model?: Model
}

type WsReady = {
  type: "ready"
}

type WsSuccess = {
  type: "translate.success"
  requestId: string
  words: WordToken[]
}

type WsDefinitionsSuccess = {
  type: "translate.definitions.success"
  requestId: string
  definitions: WordDefinition[]
}

type WsError = {
  type: "translate.error"
  requestId?: string
  error: string
}

type WsClientMessage =
  | WsRequest
  | WsDefinitionsRequest

type WsServerMessage =
  | WsReady
  | WsSuccess
  | WsDefinitionsSuccess
  | WsError

export type {
  Model,
  WordToken,
  WordDefinition,
  WsClientMessage,
  WsDefinitionsRequest,
  WsDefinitionsSuccess,
  WsError,
  WsRequest,
  WsServerMessage,
  WsSuccess
}
