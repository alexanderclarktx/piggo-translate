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
}

type WordDefinition = {
  word: string
  definition: string
}

type WsDefinitionsRequest = {
  type: "translate.definitions.request"
  requestId: string
  word: string
  context: string
  targetLanguage: string
}

type WsAudioRequest = {
  type: "translate.audio.request"
  requestId: string
  text: string
  targetLanguage: string
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

type WsAudioSuccess = {
  type: "translate.audio.success"
  requestId: string
  audioBase64: string
  mimeType: string
}

type WsError = {
  type: "translate.error"
  requestId?: string
  error: string
}

type WsClientMessage =
  | WsRequest
  | WsDefinitionsRequest
  | WsAudioRequest

type WsServerMessage =
  | WsReady
  | WsSuccess
  | WsDefinitionsSuccess
  | WsAudioSuccess
  | WsError

export type {
  WsAudioRequest,
  WsAudioSuccess,
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
