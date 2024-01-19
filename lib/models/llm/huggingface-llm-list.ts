import { LLM } from "@/types"

const HUGGINGFACE_PLATFORM_LINK = "https://huggingface.co/models"

// HuggingFace Models (UPDATED 01/18/24) -----------------------------

// HuggingFace Online 7B (UPDATED 01/18/24)
const MISTRAL_7B_INSTRUCT_V01: LLM = {
  modelId: "mistralai/Mistral-7B-Instruct-v0.1", // huggingface model Id
  modelName: "Mistral-7B-Instruct-v0.1", // Display Name
  provider: "huggingface",
  hostedId: "mistralai/Mistral-7B-Instruct-v0.1",
  platformLink: HUGGINGFACE_PLATFORM_LINK,
  imageInput: false
}

const MISTRAL_7B_V01: LLM = {
  modelId: "mistralai/Mistral-7B-v0.1",
  modelName: "Mistral-7B-v0.1",
  provider: "huggingface",
  hostedId: "mistralai/Mistral-7B-v0.1",
  platformLink: HUGGINGFACE_PLATFORM_LINK,
  imageInput: false
}

export const HUGGINGFACE_LLM_LIST: LLM[] = [
  MISTRAL_7B_INSTRUCT_V01,
  MISTRAL_7B_V01
]
