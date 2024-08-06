import { Anthropic } from '@anthropic-ai/sdk'
import { MessageParam, MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages'
import { EventIterator } from 'event-iterator'
import { tools } from '../../tools/tools'
import { Model, Provider, ProviderOptions, ProviderSpec } from '../provider'
import { getKey } from '../util/keys'
import { createProvider, Stream } from '../util/provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const models: Model[] = [
    {
        name: 'haiku',
        model: 'claude-3-haiku-20240307',
    },
    {
        name: 'sonnet',
        model: 'claude-3-5-sonnet-20240620',
        options: {
            maxTokens: 8192,
            headers: { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' },
        },
    },
    {
        name: 'opus',
        model: 'claude-3-opus-20240229',
    },
]

export const provider: ProviderSpec = {
    models,
    factory: createAnthropicProvider,
}

function createAnthropicProvider({
    model: { model, options: modelOptions },
    system,
    temperature = 0.0,
    maxTokens = modelOptions?.maxTokens || 4096,
}: ProviderOptions): Provider {
    const apiKey = getKey('anthropic')
    const defaultHeaders = modelOptions?.headers
    const client = new Anthropic({ apiKey: apiKey, defaultHeaders })
    const { messages, ...conversationManager } = createConversation()

    return createProvider({
        createStream: () =>
            createStream({
                client,
                system,
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
    system,
    messages,
    temperature,
    maxTokens,
}: {
    client: Anthropic
    model: string
    system: string
    messages: MessageParam[]
    temperature?: number
    maxTokens: number
}): Promise<Stream<MessageStreamEvent>> {
    const stream = client.messages.stream({
        model,
        system,
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
        tools: tools.map(({ name, description, parameters }) => ({
            name,
            description,
            input_schema: parameters,
        })),
    })

    const iterator = new EventIterator<MessageStreamEvent>(({ push, stop, fail }) => {
        stream.on('streamEvent', push)
        stream.on('abort', fail)
        stream.on('error', fail)
        stream.finalMessage().then(stop).catch(fail)

        return () => {
            stream.off('streamEvent', push)
            stream.off('abort', fail)
            stream.off('error', fail)
        }
    })

    return {
        iterator,
        abort: () => stream.controller.abort(),
    }
}
