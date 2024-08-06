import readline from 'readline'
import { Provider } from '../providers/provider'
import { Prompter } from '../util/prompter'

export type Tool = {
    name: string
    description: string
    parameters: JSONSchemaObject
    execute: Executor
    replay: Replayer
    serialize: Serializer
}

export type JSONSchemaObject = { type: 'object'; properties: { [key: string]: JSONSchemaType }; required: string[] }
export type JSONSchemaType = { type: string; description: string; [key: string]: unknown }

export type ExecutionContext = {
    readline: readline.Interface
    provider: Provider
    prompter: Prompter
}

export type Executor = (context: ExecutionContext, args: Arguments) => Promise<ExecutionResult>
export type Arguments = Record<string, unknown>
export type ToolResult = { result?: any; error?: Error }
export type ExecutionResult = ToolResult & { reprompt?: boolean }
export type Replayer = (args: Arguments, result: ToolResult) => void
export type Serializer = (result?: any) => string
