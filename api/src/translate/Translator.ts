import { WordDefinition, WordToken } from "@piggo-translate/core"

export type Translator = {
  translate: (text: string, targetLanguage: string) => Promise<{
    words: WordToken[]
  }>
  getDefinitions: (word: string, targetLanguage: string, context: string) => Promise<WordDefinition[]>
  getAudio: (text: string, targetLanguage: string) => Promise<Blob>
}
