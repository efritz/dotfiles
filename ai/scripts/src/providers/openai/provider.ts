import { OpenAI } from 'openai'
import { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/resources'
import { tools as toolDefinitions } from '../../tools/tools'
import { abortableIterator } from '../../util/iterator'
import { Model, Provider, ProviderOptions, ProviderSpec } from '../provider'
import { getKey } from '../util/keys'
import { createProvider, Stream } from '../util/provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const models: Model[] = [
    {
        name: 'gpt-4o',
        model: 'gpt-4o-2024-08-06',
    },
    {
        name: 'gpt-4',
        model: 'gpt-4',
    },
]

export const provider: ProviderSpec = {
    models,
    factory: createOpenAIProvider,
}

function createOpenAIProvider({
    model: { model },
    system,
    temperature = 0.0,
    maxTokens = 4096,
}: ProviderOptions): Provider {
    const apiKey = getKey('openai')
    const client = new OpenAI({ apiKey })
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
    client: OpenAI
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
        tools: toolDefinitions.map(({ name, description, parameters }) => ({
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
