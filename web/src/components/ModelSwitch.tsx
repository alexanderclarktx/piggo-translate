import { Model } from "@template/core"

type ModelSwitchProps = {
  selectedModel: Model
  onModelToggle: (model: Model) => void
  className?: string
}

const ModelSwitch = ({ selectedModel, onModelToggle, className }: ModelSwitchProps) => {
  const useOpenAi = selectedModel === "openai"

  return (
    <button
      type="button"
      className={className ? `model-switch ${className}` : "model-switch"}
      role="switch"
      aria-checked={useOpenAi}
      aria-label={`Use ${useOpenAi ? "OpenAI" : "Anthropic"} model`}
      onClick={() => {
        onModelToggle(useOpenAi ? "anthropic" : "openai")
      }}
    >
      <span className="model-switch-text">
        {useOpenAi ? "OpenAI" : "Anthropic"}
      </span>
    </button>
  )
}

export { ModelSwitch }
