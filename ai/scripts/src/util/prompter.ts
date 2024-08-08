import readline from 'readline'
import chalk from 'chalk'
import { CancelError, InterruptHandler } from './interrupts'

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
            try {
                return await interruptHandler.withInterruptHandler<string>(
                    signal => new Promise<string>(resolve => rl.question(prompt, { signal }, resolve)),
                )
            } catch (error: any) {
                if (error instanceof CancelError) {
                    return ''
                }

                throw error
            }
        },
    }
}

//
//

interface Optioner {
    choice: (prompt: string, options: ChoiceOption[]) => Promise<string>
    options: <T>(prompt: string, options: PromptOption<T>[]) => Promise<T>
}

interface ChoiceOption {
    name: string
    description: string
    isDefault?: boolean
}

interface PromptOption<T> extends ChoiceOption {
    handler: () => Promise<T>
}

function createOptioner(questioner: Questioner): Optioner {
    const options = async <T>(prompt: string, opts: PromptOption<T>[]): Promise<T> => {
        const helpOption = { name: '?', description: 'print help', isDefault: false }
        const allOptions = [...opts, helpOption]

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

            const option = opts.find(
                ({ isDefault, name }) =>
                    (value === '' && isDefault) || (value !== '' && name.toLowerCase() === value[0].toLowerCase()),
            )
            if (option) {
                return option.handler()
            }

            console.log(colorizedHelpText)
        }
    }

    const choice = (prompt: string, opts: ChoiceOption[]): Promise<string> => {
        return options(
            prompt,
            opts.map(({ name, description, isDefault }) => ({
                name,
                description,
                isDefault,
                handler: async () => name,
            })),
        )
    }

    return { choice, options }
}
