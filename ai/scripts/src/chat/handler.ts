import chalk from 'chalk'
import { Response } from '../messages/messages'
import { ProgressFunction } from '../providers/provider'
import { prefixFormatter, ProgressResult, withProgress } from '../util/progress/progress'
import { handleCommand } from './commands/commands'
import { ExitError } from './commands/control/exit'
import { ChatContext } from './context'
import { formatMessage } from './output'
import { runToolsInMessages } from './tools'

export async function handler(context: ChatContext) {
    while (true) {
        try {
            await handle(context, (await context.prompter.question('$ ')).trim())
        } catch (error) {
            if (error instanceof ExitError) {
                return
            }

            throw error
        }
    }
}

async function handle(context: ChatContext, message: string): Promise<void> {
    if (message === '') {
        return
    }

    const handledCommand = await handleCommand(context, message)
    if (handledCommand) {
        return
    }

    context.provider.conversationManager.pushUser({ type: 'text', content: message })
    await prompt(context)
}

async function prompt(context: ChatContext): Promise<void> {
    while (true) {
        const result = await promptWithProgress(context)
        if (!result.ok) {
            console.log(chalk.red(result.error))
            console.log()
            break
        }

        const { ranTools, reprompt } = await runToolsInMessages(context, result.response.messages)
        if (!ranTools) {
            break
        }

        if (!reprompt) {
            const choice = await context.prompter.choice('Continue current prompt', [
                { name: 'y', description: 'Re-prompt model' },
                { name: 'n', description: 'Supply a new prompt', isDefault: true },
            ])

            if (choice === 'n') {
                console.log(chalk.dim('ℹ') + ' Ending prompt.')
                console.log()
                break
            }
        }
    }
}

async function promptWithProgress(context: ChatContext): Promise<ProgressResult<Response>> {
    const formatResponse = (r?: Response): string =>
        (r?.messages || [])
            .map(formatMessage)
            .filter(message => message !== '')
            .join('\n\n')

    let cancel = () => {}
    const prompt = (progress?: ProgressFunction): Promise<Response> => {
        return context.provider.prompt(progress, abort => {
            cancel = abort
        })
    }

    return await context.interruptHandler.withInterruptHandler(
        () =>
            withProgress<Response>(prompt, {
                progress: prefixFormatter('Generating response...', formatResponse),
                success: prefixFormatter('Generated response.', formatResponse),
                failure: prefixFormatter('Failed to generate response.', formatResponse),
            }),
        {
            throwOnCancel: false,
            onAbort: () => cancel(),
        },
    )
}
