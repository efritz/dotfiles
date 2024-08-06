export type Response = {
    messages: AssistantMessage[]
}

export type UserMessage = TextMessage | ToolResult
export type AssistantMessage = TextMessage | ToolUseMessage
export type Message = ({ role: 'user' } & UserMessage) | ({ role: 'assistant' } & AssistantMessage)

export type TextMessage = {
    type: 'text'
    content: string
    replayContent?: string
}

export type ToolUseMessage = {
    type: 'tool_use'
    tools: ToolUse[]
}

export type ToolUse = {
    id: string
    name: string
    parameters: string
}

export type ToolResult = {
    type: 'tool_result'
    toolUse: ToolUse
    result?: any
    error?: Error
}
