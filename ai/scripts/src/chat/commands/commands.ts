import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { ChatContext } from '../context'
import { CommandDescription } from './command'
import { loadCommand } from './context/load'
import { exitCommand } from './control/exit'
import { helpCommand } from './control/help'
import { clearCommand } from './conversation/clear'
import { redoCommand } from './conversation/redo'
import { rollbackCommand } from './conversation/rollback'
import { saveCommand } from './conversation/save'
import { savepointCommand } from './conversation/savepoint'
import { undoCommand } from './conversation/undo'

export const commands: CommandDescription[] = [
    helpCommand,
    exitCommand,
    saveCommand,
    loadCommand,
    clearCommand,
    savepointCommand,
    rollbackCommand,
    undoCommand,
    redoCommand,
]

export async function handleCommand(context: ChatContext, message: string): Promise<boolean> {
    const parts = message.split(' ')
    const command = parts[0]
    const args = parts.slice(1).join(' ').trim()

    if (!command.startsWith(':')) {
        return false
    }

    for (const { prefix, handler } of commands) {
        if (command === prefix) {
            await handler(context, args)
            return true
        }
    }

    console.log(chalk.red.bold(`Unknown command`))
    console.log()
    return false
}

export function completeCommand(context: ChatContext, message: string): CompleterResult | undefined {
    const parts = message.split(' ')
    const command = parts[0]
    const args = parts.slice(1).join(' ').trim()

    if (!command.startsWith(':')) {
        return undefined
    }

    for (const { prefix, complete } of commands) {
        if (complete && command === prefix) {
            return complete(context, args)
        }
    }

    return undefined
}
