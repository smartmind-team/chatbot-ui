import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"

import { ChatSettings } from "@/types"
import { HuggingFaceStream, OpenAIStream, StreamingTextResponse } from "ai"
import { HfInferenceEndpoint } from "@huggingface/inference"
import Handlebars from "handlebars"

import { ServerRuntime } from "next"

// ugly for now. should be in a config file
// https://github.com/huggingface/chat-ui/blob/ee47ff37fddb70f78d1ef8a293d8ed3fbcd24ff9/README.md?plain=1#L175
var source =
  "{{#each messages}}" +
  "{{#ifSystem}}{{@root.systemMessageToken}}{{content}}{{@root.systemMessageEndToken}}{{/ifSystem}}" +
  "{{#ifUser}}{{@root.userMessageToken}}{{content}}{{@root.userMessageEndToken}}{{/ifUser}}" +
  "{{#ifAssistant}}{{@root.assistantMessageToken}}{{content}}{{@root.assistantMessageEndToken}}{{/ifAssistant}}" +
  "{{/each}}" +
  "{{assistantMessageToken}}"

Handlebars.registerHelper("ifUser", function (ctx, options) {
  if (ctx.role == "user") return options.fn(ctx)
})

Handlebars.registerHelper("ifAssistant", function (ctx, options) {
  if (ctx.role == "assistant") return options.fn(ctx)
})

Handlebars.registerHelper("ifSystem", function (ctx, options) {
  if (ctx.role == "system") return options.fn(ctx)
})

const template = Handlebars.compile(source)

// neeed update
function sanitizeContent(md: string) {
  let ret = md
    .replace(/<\|[a-z]*$/, "")
    .replace(/<\|[a-z]+\|$/, "")
    .replace(/<$/, "")
    .replaceAll("</s>", "")
    .replaceAll(/<\|[a-z]+\|>/g, " ")
    .replaceAll(/<br\s?\/?>/gi, "\n")
    .replaceAll("<", "&lt;")

  for (const stop of ["<|endoftext|>"]) {
    if (ret.endsWith(stop)) {
      ret = ret.slice(0, -stop.length).trim()
    }
  }

  return ret
}

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.huggingface_api_key, "HuggingFace")

    const prompt = template({
      messages,
      userMessageToken: `[INST]`,
      userMessageEndToken: `[/INST]`,
      assistantMessageToken: ``,
      assistantMessageEndToken: `</s>`,
      systemMessageToken: `<s>`,
      systemMessageEndToken: `</s>`
    })

    const response = await fetch("http://{ip}/generate_stream", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        // we don't need hugginface api key for now
        Authorization: `Bearer ${profile.huggingface_api_key}`
      },
      body: JSON.stringify({
        parameters: {
          max_new_tokens:
            CHAT_SETTING_LIMITS[chatSettings.model].MAX_TOKEN_OUTPUT_LENGTH,
          temperature: chatSettings.temperature
        },
        inputs: prompt
      })
    })

    console.log(prompt)

    const readableStream = new ReadableStream({
      async start(controller) {
        if (!response.body) {
          throw new Error("No response body!")
        }

        const reader = response.body.getReader()
        let isFirstChunk = true
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            break
          }
          const chunk = new TextDecoder("utf-8").decode(value)
          const data = chunk.replace("data:", "")
          if (data) {
            const parsedData = JSON.parse(data)
            const messageContent = parsedData.token.text
            controller.enqueue(
              new TextEncoder().encode(sanitizeContent(messageContent))
            )
          }
          isFirstChunk = false
        }
      }
    })

    return new Response(readableStream, {
      headers: { "Content-Type": "text/plain" }
    })
  } catch (error: any) {
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
