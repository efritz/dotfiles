import { writeFileSync } from 'fs'
import readline from 'readline'
import chalk from 'chalk'
import { Response } from '../messages/messages'
import { Provider } from '../providers/provider'
import { ProgressFunction } from '../providers/util/provider'
import { expandFilePatterns, readFileContents } from '../util/fs'
import { ProgressResult, withProgress } from '../util/progress'
import { Prompter } from '../util/prompter'
import { withInterruptHandler } from '../util/sigint'
import { ExitError } from './errors'
import { formatResponse } from './output'
import { runToolsInMessages } from './tools'

type ChatContext = {
    readline: readline.Interface
    provider: Provider
    prompter: Prompter
}

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

type CommandDescription = {
    prefix: string
    description: string
    expectsArgs?: boolean
    handler: (ontext: ChatContext, args: string) => void
}

export const commands: CommandDescription[] = [
    {
        prefix: ':help',
        description: 'Show this message',
        handler: async (context: ChatContext, args: string) => {
            if (args !== '') {
                console.log(chalk.red.bold('Unexpected arguments supplied to :help.'))
                console.log()
                return
            }

            const maxWidth = commands.reduce((max, { prefix }) => Math.max(max, prefix.length), 0)

            console.log()
            for (const { prefix, description } of commands) {
                console.log(`${prefix.padEnd(maxWidth)} - ${description}`)
            }
            console.log()
        },
    },
    {
        prefix: ':exit',
        description: 'Exit the chat',
        handler: async (context: ChatContext, args: string) => {
            if (args !== '') {
                console.log(chalk.red.bold('Unexpected arguments supplied to :exit.'))
                console.log()
                return
            }

            console.log('Goodbye!\n')
            throw new ExitError('User exited.')
        },
    },
    {
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
    },
    {
        prefix: ':save',
        description: 'Save the chat history',
        handler: async (context: ChatContext, args: string) => {
            if (args !== '') {
                console.log(chalk.red.bold('Unexpected arguments supplied to :save.'))
                console.log()
                return
            }

            const messages = context.provider.conversationManager.serialize()
            const filename = `chat-${Math.floor(Date.now() / 1000)}.json`
            writeFileSync(
                filename,
                JSON.stringify(
                    messages,
                    (key: string, value: any): any =>
                        value instanceof Error ? { type: 'ErrorMessage', message: value.message } : value,
                    '\t',
                ),
            )
            console.log(`Chat history saved to ${filename}\n`)
        },
    },
    {
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
    },
]

async function handle(context: ChatContext, message: string): Promise<void> {
    if (message === '') {
        return
    }

    if (message.startsWith(':')) {
        const parts = message.split(' ')
        const command = parts[0]
        const args = parts.slice(1).join(' ').trim()

        for (const { prefix, handler } of commands) {
            if (command === prefix) {
                return handler(context, args)
            }
        }

        console.log(chalk.red.bold(`Unknown command: ${command}.`))
        console.log()
        return
    }

    context.provider.conversationManager.pushUser({ type: 'text', content: message })
    return prompt(context)
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
        if (
            !ranTools ||
            (!reprompt &&
                !(await context.prompter.options('Continue current prompt', [
                    {
                        name: 'y',
                        description: 'Re-prompt model',
                        handler: async () => true,
                    },
                    {
                        name: 'n',
                        description: 'Supply a new prompt',
                        isDefault: true,
                        handler: async () => {
                            console.log(chalk.dim('ℹ') + ' Ending prompt.')
                            console.log()
                            return false
                        },
                    },
                ])))
        ) {
            break
        }
    }
}

async function promptWithProgress(context: ChatContext): Promise<ProgressResult<Response>> {
    let cancel = () => {}
    const prompt = (progress?: ProgressFunction): Promise<Response> => {
        return context.provider.prompt(progress, abort => {
            cancel = abort
        })
    }

    return await withInterruptHandler(
        context.readline,
        () => cancel(),
        () =>
            withProgress<Response>(prompt, {
                progress: snapshot => formatResponse('Generating response...', snapshot),
                success: snapshot => formatResponse('Generated response.', snapshot),
                failure: (snapshot, error) => formatResponse('Failed to generate response.', snapshot),
            }),
    )
}
