import { Response } from '../../messages/messages'
import { Provider } from '../provider'
import { ConversationManager } from './conversation'
import { Reducer, reduceStream } from './reducer'

export type Aborter = () => void
export type AbortRegisterer = (abort: Aborter) => void
export type ProgressFunction = (r?: Response) => void

export type Stream<T> = { iterator: AsyncIterable<T>; abort: Aborter }
export type StreamFactory<T> = () => Promise<Stream<T>>
export type ReducerFactory<T> = () => Reducer<T>

export type ProviderOptions<T> = {
    createStream: StreamFactory<T>
    createStreamReducer: ReducerFactory<T>
    conversationManager: ConversationManager
}

export function createProvider<T>({
    createStream,
    createStreamReducer,
    conversationManager,
}: ProviderOptions<T>): Provider {
    const prompt = async (progress?: ProgressFunction, abortRegisterer?: AbortRegisterer) => {
        const { iterator, abort } = await createStream()
        abortRegisterer?.(abort)

        const reducerOptions = {
            iterator,
            reducer: createStreamReducer(),
            progress,
        }

        const response = await reduceStream(reducerOptions)
        conversationManager.pushAssistant(response.messages)
        return response
    }

    return { conversationManager, prompt }
}
