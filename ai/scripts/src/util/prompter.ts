import readline from 'readline/promises'
import chalk from 'chalk'
import { InterruptHandler } from './interrupts'

export interface Prompter {
    question(prompt: string): Promise<string>
    options<T>(prompt: string, options: PromptOption<T>[]): Promise<T>
}

type PromptOption<T> = {
    name: string
    description: string
    isDefault?: boolean
    handler: () => Promise<T>
}

export function createPrompter(rl: readline.Interface, interruptHandler: InterruptHandler): Prompter {
    return {
        question: prompt => question(rl, interruptHandler, prompt),
        options: (prompt, promptOptions) => options(rl, interruptHandler, prompt, promptOptions),
    }
}

async function question(rl: readline.Interface, interruptHandler: InterruptHandler, prompt: string): Promise<string> {
    const controller = new AbortController()

    try {
        return await interruptHandler.withInterruptHandler<string>(
            () => controller.abort(),
            () => rl.question(prompt, { signal: controller.signal }),
        )
    } catch (error: any) {
        if (error.name === 'AbortError') {
            return ''
        }

        throw error
    }
}

async function options<T>(
    rl: readline.Interface,
    interruptHandler: InterruptHandler,
    prompt: string,
    options: PromptOption<T>[],
): Promise<T> {
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
        const value = await question(rl, interruptHandler, colorizedPrompt)

        const option = options.find(
            ({ isDefault, name }) =>
                (value === '' && isDefault) || (value !== '' && name.toLowerCase() === value[0].toLowerCase()),
        )
        if (option) {
            return option.handler()
        }

        console.log(colorizedHelpText)
    }
}
