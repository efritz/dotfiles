import chalk from 'chalk'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

export const redoCommand: CommandDescription = {
    prefix: ':redo',
    description: 'Redo the last undone action in the conversation',
    handler: handleRedo,
}

async function handleRedo(context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :redo.'))
        console.log()
        return
    }

    if (!context.provider.conversationManager.redo()) {
        console.log(chalk.red('Nothing to redo.'))
        console.log()
        return
    }

    console.log('Last undone action redone.')
    console.log()
}
