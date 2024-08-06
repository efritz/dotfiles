import ollama, { ChatResponse, Message } from 'ollama'
import { tools } from '../../tools/tools'
import { abortableIterator } from '../../util/iterator'
import { Model, Provider, ProviderOptions, ProviderSpec } from '../provider'
import { createProvider, Stream } from '../util/provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const models: Model[] = [
    {
        name: 'llama3',
        model: 'llama3.1',
    },
]

export const provider: ProviderSpec = {
    models,
    factory: createOllamaProvider,
}

function createOllamaProvider({
    model: { model },
    system,
    temperature = 0.0,
    maxTokens = 4096,
}: ProviderOptions): Provider {
    const { messages, ...conversationManager } = createConversation(system)

    return createProvider({
        createStream: () =>
            createStream({
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
    model,
    messages,
    temperature,
    maxTokens,
}: {
    model: string
    messages: Message[]
    temperature?: number
    maxTokens?: number
}): Promise<Stream<ChatResponse>> {
    async function* createIterable() {
        const response = ollama.chat({
            model,
            messages,
            options: {
                temperature,
                num_predict: maxTokens,
            },
            tools: tools.map(({ name, description, parameters }) => ({
                type: '',
                function: {
                    name,
                    description,
                    parameters,
                },
            })),
        })

        // https://github.com/ollama/ollama-js/issues/123
        yield response
    }

    return abortableIterator(createIterable(), () => {})
}
