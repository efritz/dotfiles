import { AssistantMessage, Message, MetaMessage, UserMessage } from '../messages/messages'

export type Conversation<T> = ConversationManager & {
    providerMessages: () => T[]
}

export type ConversationManager = {
    messages(): Message[]
    setMessages(messages: Message[]): void

    pushUser(message: UserMessage): void
    pushAssistant(messages: AssistantMessage[]): void

    savepoints(): string[]
    addSavepoint(name: string): boolean
    rollbackToSavepoint(name: string): boolean
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

    const setMessages = (messages: Message[]) => {
        chatMessages.length = 0
        providerMessages.length = 0

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

    const pushMeta = (message: MetaMessage) => {
        chatMessages.push({ ...message, role: 'meta' })
    }

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

    const savepoints = (): string[] => {
        return chatMessages
            .filter(message => message.role === 'meta' && message.type === 'savepoint')
            .map(message => message.name)
    }

    const addSavepoint = (name: string): boolean => {
        if (savepoints().includes(name)) {
            return false
        }

        chatMessages.push({ role: 'meta', type: 'savepoint', name })
        return true
    }

    const rollbackToSavepoint = (name: string): boolean => {
        const prefix: Message[] = []
        for (const message of chatMessages) {
            if (message.role === 'meta' && message.type === 'savepoint' && message.name === name) {
                setMessages(prefix)
                return true
            }

            prefix.push(message)
        }

        return false
    }

    return {
        providerMessages: () => providerMessages,
        messages: () => chatMessages,
        setMessages,
        pushUser,
        pushAssistant,
        savepoints,
        addSavepoint,
        rollbackToSavepoint,
    }
}
