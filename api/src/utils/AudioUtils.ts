export const decodeBase64PcmChunksToWavBlob = (chunks: string[]) => {
  const sampleRate = 24000
  const channelCount = 1
  const bitsPerSample = 16

  if (!chunks.length) {
    return new Blob([], { type: "audio/wav" })
  }

  const pcmAudio = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk, "base64")))
  const boostedPcmAudio = boostPcm16Volume({ pcmAudio })
  const wavAudio = encodePcm16ToWav({
    pcmAudio: boostedPcmAudio,
    sampleRate,
    channelCount,
    bitsPerSample
  })

  return new Blob([wavAudio], { type: "audio/wav" })
}

type BoostPcm16VolumeInput = {
  pcmAudio: Buffer
  maxBoostFactor?: number
  targetPeakAmplitude?: number
}

const boostPcm16Volume = ({
  pcmAudio,
  maxBoostFactor = 1.8,
  targetPeakAmplitude = 29490
}: BoostPcm16VolumeInput) => {
  if (pcmAudio.length < 2) {
    return pcmAudio
  }

  let maxAbsoluteSample = 0

  for (let offset = 0; offset + 1 < pcmAudio.length; offset += 2) {
    const sample = pcmAudio.readInt16LE(offset)
    const absoluteSample = Math.abs(sample)

    if (absoluteSample > maxAbsoluteSample) {
      maxAbsoluteSample = absoluteSample
    }
  }

  if (!maxAbsoluteSample) {
    return pcmAudio
  }

  const safeBoostFactor = targetPeakAmplitude / maxAbsoluteSample
  const gain = Math.max(1, Math.min(maxBoostFactor, safeBoostFactor))

  if (gain === 1) {
    return pcmAudio
  }

  const boostedPcmAudio = Buffer.from(pcmAudio)

  for (let offset = 0; offset + 1 < boostedPcmAudio.length; offset += 2) {
    const sample = boostedPcmAudio.readInt16LE(offset)
    const boostedSample = Math.round(sample * gain)
    const clampedSample = Math.max(-32768, Math.min(32767, boostedSample))
    boostedPcmAudio.writeInt16LE(clampedSample, offset)
  }

  return boostedPcmAudio
}

type EncodePcm16ToWavInput = {
  pcmAudio: Buffer
  sampleRate: number
  channelCount: number
  bitsPerSample: number
}

const encodePcm16ToWav = ({
  pcmAudio,
  sampleRate,
  channelCount,
  bitsPerSample
}: EncodePcm16ToWavInput) => {
  const headerSize = 44
  const dataSize = pcmAudio.length
  const blockAlign = (channelCount * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const totalSize = headerSize + dataSize

  const wavBuffer = Buffer.alloc(totalSize)
  wavBuffer.write("RIFF", 0)
  wavBuffer.writeUInt32LE(36 + dataSize, 4)
  wavBuffer.write("WAVE", 8)
  wavBuffer.write("fmt ", 12)
  wavBuffer.writeUInt32LE(16, 16)
  wavBuffer.writeUInt16LE(1, 20)
  wavBuffer.writeUInt16LE(channelCount, 22)
  wavBuffer.writeUInt32LE(sampleRate, 24)
  wavBuffer.writeUInt32LE(byteRate, 28)
  wavBuffer.writeUInt16LE(blockAlign, 32)
  wavBuffer.writeUInt16LE(bitsPerSample, 34)
  wavBuffer.write("data", 36)
  wavBuffer.writeUInt32LE(dataSize, 40)
  pcmAudio.copy(wavBuffer, headerSize)

  return wavBuffer
}
