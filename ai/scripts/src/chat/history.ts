import { AssistantMessage, Message, UserMessage } from '../messages/messages'
import { tools } from '../tools/tools'
import { formatMessage } from './output'

export function replayChat(messages: Message[]): void {
    for (const message of messages) {
        switch (message.role) {
            case 'user':
                replayUserMessage(message)
                break

            case 'assistant':
                replayAssistantMessage(message)
                break
        }
    }
}

function replayUserMessage(message: UserMessage): void {
    switch (message.type) {
        case 'text': {
            console.log(message.replayContent ?? `$ ${message.content}`)
            console.log()
            break
        }

        case 'tool_result': {
            const tool = tools.find(({ name }) => name === message.toolUse.name)
            if (!tool) {
                throw new Error(`Tool not found: ${message.toolUse.name}`)
            }

            tool.replay(JSON.parse(message.toolUse.parameters), { result: message.result, error: message.error })
            console.log()
            break
        }
    }
}

function replayAssistantMessage(message: AssistantMessage): void {
    const content = formatMessage(message)
    if (content) {
        console.log(content)
        console.log()
    }
}
