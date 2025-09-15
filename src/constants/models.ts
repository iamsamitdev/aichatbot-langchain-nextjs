export interface ModelOption {
  name: string
  description: string
  provider: 'OpenAI' | 'Google' | 'Azure' | 'OpenRouter' | 'Ollama' | 'vLLM' | 'Gradient'
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    name: "gpt-4o-mini",
    description: "OpenAI GPT-4o Mini - Fast and efficient",
    provider: "OpenAI"
  },
  {
    name: "gemini-2.5-flash",
    description: "Google Gemini 2.5 Flash - Quick responses",
    provider: "Google"
  },
  {
    name: "gpt-5-mini",
    description: "Azure OpenAI GPT-5 Mini - Microsoft Azure",
    provider: "Azure"
  },
  {
    name: "qwen/qwen3-235b-a22b-2507",
    description: "OpenRouter Qwen 3 235B - Large model",
    provider: "OpenRouter"
  },
  {
    name: "qwen/qwen3-8b:free",
    description: "OpenRouter Qwen 3 8B - Free tier",
    provider: "OpenRouter"
  },
  {
    name: "gemma:2b",
    description: "Ollama Gemma 2B - Local lightweight model",
    provider: "Ollama"
  },
  {
    name: "meta-llama/llama-3.3-70b-instruct",
    description: "vLLM Llama 3.3 70B - Self-hosted",
    provider: "vLLM"
  },
  {
    name: "openai-gpt-oss-120b",
    description: "Gradient AI GPT OSS 120B - DigitalOcean",
    provider: "Gradient"
  }
]

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].name