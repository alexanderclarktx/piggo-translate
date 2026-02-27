export type Translator = {
  translate: (text: string, targetLanguage: string) => Promise<{
    words: string[]
    transliteration: string
  }>
}
