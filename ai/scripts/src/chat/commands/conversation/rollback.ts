import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { ChatContext } from '../../context'
import { CommandDescription } from './../command'

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

    if (!context.provider.conversationManager.rollbackToSavepoint(name)) {
        console.log(chalk.red.bold(`Savepoint "${name}" not found.`))
        console.log()
        return
    }

    console.log(`Rolled back to savepoint "${name}".`)
    console.log()
}

function completeRollback(context: ChatContext, args: string): CompleterResult {
    return [context.provider.conversationManager.savepoints().filter(name => name.startsWith(args)), args]
}
