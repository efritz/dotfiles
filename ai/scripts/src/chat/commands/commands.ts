import chalk from 'chalk'
import { ChatContext } from '../context'
import { CommandDescription } from './command'
import { loadCommand } from './context/load'
import { exitCommand } from './control/exit'
import { helpCommand } from './control/help'
import { clearCommand } from './conversation/clear'
import { saveCommand } from './conversation/save'

export const commands: CommandDescription[] = [helpCommand, exitCommand, clearCommand, saveCommand, loadCommand]

export async function handleCommand(context: ChatContext, message: string): Promise<boolean> {
    if (!message.startsWith(':')) {
        return false
    }

    const handler = findCommand(message)
    if (handler) {
        await handler(context)
    } else {
        console.log(chalk.red.bold(`Unknown command`))
        console.log()
    }

    return true
}

export function findCommand(message: string): ((context: ChatContext) => Promise<void>) | undefined {
    const parts = message.split(' ')
    const command = parts[0]
    const args = parts.slice(1).join(' ').trim()

    for (const { prefix, handler } of commands) {
        if (command === prefix) {
            return (context: ChatContext) => handler(context, args)
        }
    }

    return undefined
}
