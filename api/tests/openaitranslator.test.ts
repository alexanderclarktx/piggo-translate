import { describe, expect, test } from "bun:test"
import { OpenAiTranslator } from "../src/translate/OpenAiTranslator"

const integrationTest = process.env.OPENAI_API_KEY ? test : test.skip

describe("OpenAiTranslator.getAudio", () => {
  integrationTest("returns an audio blob from the realtime websocket", async () => {
    const translator = OpenAiTranslator()
    const audio = await translator.getAudio("hello", "French")

    expect(audio).toBeInstanceOf(Blob)
    expect(audio.type).toBe("audio/wav")
    expect(audio.size).toBeGreaterThan(0)
  })

  integrationTest("supports multiple audio requests on one translator instance", async () => {
    const translator = OpenAiTranslator()
    const firstAudio = await translator.getAudio("hello", "French")
    const secondAudio = await translator.getAudio("hello again", "French")

    expect(firstAudio).toBeInstanceOf(Blob)
    expect(firstAudio.type).toBe("audio/wav")
    expect(firstAudio.size).toBeGreaterThan(0)

    expect(secondAudio).toBeInstanceOf(Blob)
    expect(secondAudio.type).toBe("audio/wav")
    expect(secondAudio.size).toBeGreaterThan(0)
  })
})
