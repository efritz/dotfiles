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

    undo(): boolean
    redo(): boolean
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
    const undoStack: Message[][] = []

    const setMessages = (messages: Message[], preserveUndoStack = false) => {
        chatMessages.length = 0
        providerMessages.length = 0

        for (const message of messages) {
            switch (message.role) {
                case 'meta':
                    pushMeta(message)
                    break

                case 'user':
                    pushUser(message, preserveUndoStack)
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

    const pushUser = (message: UserMessage, preserveUndoStack = false) => {
        if (providerMessages.length === 0 && initialMessage) {
            providerMessages.push(initialMessage)
        }

        chatMessages.push({ ...message, role: 'user' })
        providerMessages.push(userMessageToParam(message))
        postPush?.(providerMessages)

        if (!preserveUndoStack) {
            undoStack.length = 0
        }
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

    const lastIndexMatching = (predicate: (message: Message) => boolean): number => {
        for (let i = chatMessages.length - 1; i >= 0; i--) {
            if (predicate(chatMessages[i])) {
                return i
            }
        }

        return -1
    }

    const rollbackToSavepoint = (name: string): boolean => {
        const index = lastIndexMatching(
            message => message.role === 'meta' && message.type === 'savepoint' && message.name === name,
        )
        if (index < 0) {
            return false
        }

        setMessages(chatMessages.slice(0, index), false)
        return true
    }

    const undo = (): boolean => {
        const index = lastIndexMatching(message => message.role === 'user')
        if (index < 0) {
            return false
        }

        const top = chatMessages.splice(index)
        undoStack.push(top)
        setMessages([...chatMessages], true)
        return true
    }

    const redo = (): boolean => {
        const messagesToRedo = undoStack.pop()
        if (!messagesToRedo) {
            return false
        }

        setMessages([...chatMessages, ...messagesToRedo], true)
        return true
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
        undo,
        redo,
    }
}
