import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { Message } from '../../../messages/messages'
import { ChatContext } from '../../context'
import { CommandDescription } from './../command'
import { savepoints } from './savepoint'

export const rollbackCommand: CommandDescription = {
    prefix: ':rollback',
    description: 'Rollback to a previously registered savepoint.',
    expectsArgs: true,
    handler: handleRollback,
    complete: completeRollback,
}

async function handleRollback(context: ChatContext, args: string): Promise<void> {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length !== 1) {
        console.log(chalk.red.bold('Expected exactly one name for :rollback.'))
        console.log()
        return
    }
    const name = parts[0]

    if (rollback(context, name)) {
        console.log(`Rolled back to savepoint "${name}".`)
        console.log()
    } else {
        console.log(chalk.red.bold(`Savepoint "${name}" not found.`))
        console.log()
    }
}

function rollback(context: ChatContext, name: string): boolean {
    const prefix: Message[] = []
    for (const message of context.provider.conversationManager.messages()) {
        if (message.role === 'meta' && message.type === 'savepoint' && message.name === name) {
            context.provider.conversationManager.setMessages(prefix)
            return true
        }

        prefix.push(message)
    }

    return false
}

function completeRollback(context: ChatContext, args: string): CompleterResult {
    return [savepoints(context.provider.conversationManager.messages()).filter(name => name.startsWith(args)), args]
}
