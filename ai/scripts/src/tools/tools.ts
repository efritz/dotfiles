import { readDirectories, readFiles, writeFile } from './fs'
import { shellExecute } from './shell'
import { Tool, ToolResult } from './tool'

export const tools: Tool[] = [shellExecute, readDirectories, readFiles, writeFile]

export function findTool(name: string): Tool {
    const tool = tools.find(tool => tool.name === name)
    if (!tool) {
        throw new Error(`Tool not found: ${name}`)
    }

    return tool
}

export function serializeToolResult(name: string, message: ToolResult): string {
    let result = findTool(name).serialize(message.result)
    if (message.error) {
        return (result += `\n\nError: ${message.error.message}`)
    }

    return result
}
