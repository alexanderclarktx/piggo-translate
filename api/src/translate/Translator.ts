import { TranslateWordDefinition, TranslateWordToken } from "@template/core"

export type Translator = {
  translate: (text: string, targetLanguage: string) => Promise<{
    words: TranslateWordToken[]
  }>
  getDefinitions: (word: string, targetLanguage: string) => Promise<TranslateWordDefinition[]>
}
