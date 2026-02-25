type TranslateWsRequestMessage = {
  type: "translate.request"
  requestId: string
  text: string
  targetLanguage: string
}

type TranslateWsReadyMessage = {
  type: "ready"
}

type TranslateWsSuccessMessage = {
  type: "translate.success"
  requestId: string
  text: string
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
  TranslateWsClientMessage,
  TranslateWsErrorMessage,
  TranslateWsRequestMessage,
  TranslateWsServerMessage,
  TranslateWsSuccessMessage
}
