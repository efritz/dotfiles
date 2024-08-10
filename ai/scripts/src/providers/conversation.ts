import { AssistantMessage, Message, UserMessage } from '../messages/messages'

export type Conversation<T> = ConversationManager & {
    providerMessages: () => T[]
}

export type ConversationManager = {
    messages(): Message[]
    pushUser(message: UserMessage): void
    pushAssistant(messages: AssistantMessage[]): void
    clear(): void
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
    postPush,
}: ConversationOptions<T>): Conversation<T> {
    const chatMessages: Message[] = []
    const providerMessages: T[] = []

    const pushUser = (message: UserMessage) => {
        if (providerMessages.length === 0 && initialMessage) {
            providerMessages.push(initialMessage)
        }

        chatMessages.push({ ...message, role: 'user' })
        providerMessages.push(userMessageToParam(message))
        postPush?.(providerMessages)
    }

    const pushAssistant = (messages: AssistantMessage[]) => {
        for (const m of messages) {
            chatMessages.push({ ...m, role: 'assistant' })
        }
        providerMessages.push(assistantMessagesToParam(messages))
        postPush?.(providerMessages)
    }

    const clear = () => {
        chatMessages.length = 0
        providerMessages.length = 0
    }

    const set = (messages: Message[]) => {
        clear()

        for (const message of messages) {
            switch (message.role) {
                case 'meta':
                    pushMeta(message)
                    break

                case 'user':
                    pushUser(message)
                    break

                case 'assistant':
                    pushAssistant([message])
                    break
            }
        }
    }

    return {
        providerMessages: () => providerMessages,
        messages: () => chatMessages,
        pushUser,
        pushAssistant,
        clear,
    }
}
