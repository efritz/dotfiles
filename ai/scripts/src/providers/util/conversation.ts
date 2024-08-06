import { AssistantMessage, Message, UserMessage } from '../../messages/messages'

export type ConversationManager = {
    pushUser(message: UserMessage): void
    pushAssistant(messages: AssistantMessage[]): void
    clear(): void
    serialize(): Message[]
}

export type Conversation<T> = ConversationManager & {
    messages: T[]
}

type ConversationOptions<T> = {
    userMessageToParam: (message: UserMessage) => T
    assistantMessagesToParam: (messages: AssistantMessage[]) => T
    initialMessage?: T
    postPush?: (MessageChannel: T[]) => void
}

export function createConversation<T>({
    userMessageToParam,
    assistantMessagesToParam,
    initialMessage,
    postPush: reducer,
}: ConversationOptions<T>): Conversation<T> {
    const chatMessages: Message[] = []
    const providerMessages: T[] = []

    const pushUser = (message: UserMessage) => {
        if (providerMessages.length === 0 && initialMessage) {
            providerMessages.push(initialMessage)
        }

        chatMessages.push({ ...message, role: 'user' })
        providerMessages.push(userMessageToParam(message))
        reducer?.(providerMessages)
    }

    const pushAssistant = (messages: AssistantMessage[]) => {
        for (const m of messages) {
            chatMessages.push({ ...m, role: 'assistant' })
        }
        providerMessages.push(assistantMessagesToParam(messages))
        reducer?.(providerMessages)
    }

    const clear = () => {
        chatMessages.length = 0
        providerMessages.length = 0
    }

    const serialize = () => {
        return chatMessages
    }

    return { messages: providerMessages, pushUser, pushAssistant, clear, serialize }
}
