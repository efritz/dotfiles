import Groq from 'groq-sdk'
import { ChatCompletionChunk, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions'
import { tools } from '../../tools/tools'
import { abortableIterator } from '../../util/iterator'
import { Model, Provider, ProviderOptions, ProviderSpec } from '../provider'
import { getKey } from '../util/keys'
import { createProvider, Stream } from '../util/provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const models: Model[] = [
    {
        name: 'llama3-70b',
        model: 'llama3-8b-8192',
    },
]

export const provider: ProviderSpec = {
    models,
    factory: createGroqProvider,
}

function createGroqProvider({
    model: { model },
    system,
    temperature = 0.0,
    maxTokens = 4096,
}: ProviderOptions): Provider {
    const apiKey = getKey('groq')
    const client = new Groq({ apiKey })
    const { messages, ...conversationManager } = createConversation(system)

    return createProvider({
        createStream: () =>
            createStream({
                client,
                model,
                messages,
                temperature,
                maxTokens,
            }),
        createStreamReducer,
        conversationManager,
    })
}

async function createStream({
    client,
    model,
    messages,
    temperature,
    maxTokens,
}: {
    client: Groq
    model: string
    messages: ChatCompletionMessageParam[]
    temperature?: number
    maxTokens?: number
}): Promise<Stream<ChatCompletionChunk>> {
    const iterable = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
        tools: tools.map(({ name, description, parameters }) => ({
            type: 'function',
            function: {
                name,
                description,
                parameters,
            },
        })),
    })

    return abortableIterator(iterable, () => iterable.controller.abort())
}
