import { AssistantMessage, ToolResult, ToolUse } from '../messages/messages'
import { ExecutionContext } from '../tools/tool'
import { findTool } from '../tools/tools'

export async function runToolsInMessages(
    context: ExecutionContext,
    messages: AssistantMessage[],
): Promise<{ ranTools: boolean; reprompt: boolean }> {
    const tools = messages.flatMap(m => (m.type !== 'tool_use' ? [] : m.tools))
    const { reprompt } = await runTools(context, tools)

    return { ranTools: tools.length > 0, reprompt }
}

async function runTools(context: ExecutionContext, toolUses: ToolUse[]): Promise<{ reprompt: boolean }> {
    let repromptAny = false
    for (const t of toolUses) {
        const { reprompt } = await runTool(context, t)
        repromptAny = repromptAny || reprompt
    }

    return { reprompt: repromptAny }
}

async function runTool(context: ExecutionContext, toolUse: ToolUse): Promise<{ reprompt: boolean }> {
    const tool = findTool(toolUse.name)
    const { result, error, reprompt } = await tool.execute(context, JSON.parse(toolUse.parameters))
    const toolResult: ToolResult = { type: 'tool_result', toolUse, result, error }
    context.provider.conversationManager.pushUser(toolResult)
    return { reprompt: reprompt ?? false }
}
