import chalk from 'chalk'
import { expandFilePatterns } from '../../../util/fs/glob'
import { readFileContents } from '../../../util/fs/read'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

export const loadCommand: CommandDescription = {
    prefix: ':load',
    description: 'Load file contents into the chat context (supports wildcards)',
    expectsArgs: true,
    handler: async (context: ChatContext, args: string) => {
        const patterns = args.split(' ').filter(p => p.trim() !== '')
        if (patterns.length === 0) {
            console.log(chalk.red.bold('No patterns supplied to :load.'))
            console.log()
            return
        }

        const result = await readFileContents(expandFilePatterns(patterns).sort())

        if (result.ok) {
            context.provider.conversationManager.pushUser({
                type: 'text',
                content: JSON.stringify(result),
                replayContent: result.response
                    .map(({ path }) => `${chalk.dim('ℹ')} Read file "${chalk.red(path)}" into context.`)
                    .join('\n'),
            })
        } else {
            console.log(chalk.red.bold(`Failed to load files: ${result.error}.`))
        }
    },
}
