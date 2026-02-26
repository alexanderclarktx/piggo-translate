export type Translator = {
  translate: (text: string, targetLanguage: string) => Promise<{
    translation: string
    transliteration: string
  }>
}
