import { WordDefinition, WordToken } from "@template/core"

export type Translator = {
  translate: (text: string, targetLanguage: string) => Promise<{
    words: WordToken[]
  }>
  getDefinitions: (word: string, targetLanguage: string) => Promise<WordDefinition[]>
}
