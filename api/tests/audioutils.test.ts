import { describe, expect, test } from "bun:test"
import { decodeBase64PcmChunksToWavBlob } from "../src/utils/AudioUtils"

const readWavSamples = async (wavBlob: Blob) => {
  const wavBuffer = Buffer.from(await wavBlob.arrayBuffer())
  const pcmData = wavBuffer.subarray(44)
  const samples: number[] = []

  for (let offset = 0; offset + 1 < pcmData.length; offset += 2) {
    samples.push(pcmData.readInt16LE(offset))
  }

  return samples
}

describe("decodeBase64PcmChunksToWavBlob", () => {
  test("boosts quiet pcm16 samples", async () => {
    const pcmBuffer = Buffer.alloc(8)
    pcmBuffer.writeInt16LE(1000, 0)
    pcmBuffer.writeInt16LE(-1000, 2)
    pcmBuffer.writeInt16LE(500, 4)
    pcmBuffer.writeInt16LE(-500, 6)

    const wavBlob = decodeBase64PcmChunksToWavBlob([pcmBuffer.toString("base64")])
    const samples = await readWavSamples(wavBlob)

    expect(samples).toEqual([1800, -1800, 900, -900])
  })

  test("does not increase already loud pcm16 samples", async () => {
    const pcmBuffer = Buffer.alloc(4)
    pcmBuffer.writeInt16LE(32000, 0)
    pcmBuffer.writeInt16LE(-32000, 2)

    const wavBlob = decodeBase64PcmChunksToWavBlob([pcmBuffer.toString("base64")])
    const samples = await readWavSamples(wavBlob)

    expect(samples).toEqual([32000, -32000])
  })
})
