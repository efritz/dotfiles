import { Response } from '../messages/messages'
import { ConversationManager } from './util/conversation'
import { AbortRegisterer, ProgressFunction } from './util/provider'

export type Model = {
    name: string
    model: string
    options?: any
}

export type Provider = {
    conversationManager: ConversationManager
    prompt: (progress?: ProgressFunction, abortRegisterer?: AbortRegisterer) => Promise<Response>
}

export type ProviderSpec = {
    models: Model[]
    factory: ProviderFactory
}

export type ProviderOptions = {
    model: Model
    system: string
    temperature?: number
    maxTokens?: number
}

export type ProviderFactory = (opts: ProviderOptions) => Provider
