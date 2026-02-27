import { TranslateWordDefinition } from "@template/core"

export type Translator = {
  translate: (text: string, targetLanguage: string) => Promise<{
    words: string[]
    transliteration: string
  }>
  getDefinitions: (words: string[], targetLanguage: string) => Promise<TranslateWordDefinition[]>
}
