import { readFileSync } from 'fs'
import readline from 'readline'
import { program } from 'commander'
import { ChatContext, handler } from './chat/chat'
import { completer } from './chat/completer'
import { replayChat } from './chat/history'
import { Message } from './messages/messages'
import { createProvider, modelNames } from './providers/providers'
import { createInterruptHandler, InterruptHandler } from './util/interrupts'
import { createPrompter } from './util/prompter'

async function main() {
    program
        .name('ai')
        .description('Personalized AI in the terminal.')
        .showHelpAfterError(true)
        .allowExcessArguments(false)
        .storeOptionsAsProperties()

    const modelFlags = '-m, --model <string>'
    const modelDescription = `Model to use. Valid options are ${modelNames.join(', ')}.`
    const modelDefault = 'sonnet'

    const historyFlags = '-h, --history <string>'
    const historyDescription = 'File to load chat history from.'

    program
        .option(modelFlags, modelDescription, modelDefault)
        .option(historyFlags, historyDescription)
        .action(options => chat(options.model, options.history))

    program.parse(process.argv)
}

async function chat(model: string, historyFilename?: string) {
    if (!process.stdin.setRawMode) {
        throw new Error('chat command is not supported in this environment.')
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer,
    })

    let last: Date
    const threshold = 1000

    const onAbort = () => {
        const now = new Date()
        if (last && now.getTime() - last.getTime() <= threshold) {
            console.log()
            console.log('Goodbye!\n')
            rl.close()
            process.exit(0)
        }

        process.stdout.write('^C')
        rl.pause()
        rl.resume()
        last = now
    }

    const interruptHandler = createInterruptHandler(rl)

    const context = {
        interruptHandler,
        provider: createProvider(model, 'You are an assistant!'),
        prompter: createPrompter(rl, interruptHandler),
    }

    try {
        await interruptHandler.withInterruptHandler(() => chatWithReadline(context, model, historyFilename), {
            onAbort,
            permanent: true,
        })
    } finally {
        rl.close()
    }
}

async function chatWithReadline(context: ChatContext, model: string, historyFilename?: string) {
    if (historyFilename) {
        const messages: Message[] = JSON.parse(readFileSync(historyFilename, 'utf8'), (key: string, value: any) => {
            if (value && value.type === 'ErrorMessage') {
                return new Error(value.message)
            }

            return value
        })

        for (const message of messages) {
            if (message.role === 'user') {
                context.provider.conversationManager.pushUser(message)
            } else {
                context.provider.conversationManager.pushAssistant([message])
            }
        }

        replayChat(messages)
    }

    console.log(`${historyFilename ? 'Resuming' : 'Beginning'} session with ${model}...\n`)
    await handler(context)
}

await main()
