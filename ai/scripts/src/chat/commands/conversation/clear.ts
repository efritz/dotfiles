import chalk from 'chalk'
import { ChatContext } from '../../context'
import { CommandDescription } from './../command'

export const clearCommand: CommandDescription = {
    prefix: ':clear',
    description: 'Clear the chat history',
    handler: async (context: ChatContext, args: string) => {
        if (args !== '') {
            console.log(chalk.red.bold('Unexpected arguments supplied to :clear.'))
            console.log()
            return
        }

        context.provider.conversationManager.clear()
        console.log('Chat history cleared.\n')
    },
}
