import readline from 'readline'
import chalk from 'chalk'
import { InterruptHandler } from './interrupts'
import { invertPromise } from './promise'

export interface Prompter extends Questioner, Optioner {}

export function createPrompter(rl: readline.Interface, interruptHandler: InterruptHandler): Prompter {
    const questioner = createQuestioner(rl, interruptHandler)
    return { ...questioner, ...createOptioner(questioner) }
}

//
//

interface Questioner {
    question: (prompt: string) => Promise<string>
}

function createQuestioner(rl: readline.Interface, interruptHandler: InterruptHandler): Questioner {
    return {
        question: async (prompt: string): Promise<string> => {
            const controller = new AbortController()
            const { promise, reject } = invertPromise<never>()

            try {
                return await interruptHandler.withInterruptHandler<string>(
                    () =>
                        Promise.race([
                            promise.catch(() => ''),
                            new Promise<string>(resolve => rl.question(prompt, { signal: controller.signal }, resolve)),
                        ]),
                    {
                        onAbort: () => {
                            controller.abort()
                            reject()
                        },
                    },
                )
            } catch (error: any) {
                throw error
            }
        },
    }
}

//
//

interface Optioner {
    options: <T>(prompt: string, options: PromptOption<T>[]) => Promise<T>
}

type PromptOption<T> = {
    name: string
    description: string
    isDefault?: boolean
    handler: () => Promise<T>
}

function createOptioner(questioner: Questioner): Optioner {
    return {
        options: async <T>(prompt: string, options: PromptOption<T>[]): Promise<T> => {
            const helpOption = { name: '?', description: 'print help', isDefault: false }
            const allOptions = [...options, helpOption]

            const normalizedOptions = allOptions.map(({ name, ...rest }) => ({
                name: rest.isDefault ? name.toUpperCase() : name.toLowerCase(),
                ...rest,
            }))

            const optionNames = normalizedOptions.map(({ name }) => name)
            const formattedPrompt = `${prompt} [${optionNames.join('/')}]? `
            const colorizedPrompt = chalk.cyanBright(formattedPrompt)

            const helpText = normalizedOptions.map(({ name, description }) => `${name} - ${description}`).join('\n')
            const colorizedHelpText = chalk.bold.red(helpText)

            while (true) {
                const value = await questioner.question(colorizedPrompt)

                const option = options.find(
                    ({ isDefault, name }) =>
                        (value === '' && isDefault) || (value !== '' && name.toLowerCase() === value[0].toLowerCase()),
                )
                if (option) {
                    return option.handler()
                }

                console.log(colorizedHelpText)
            }
        },
    }
}
