import { readFileSync } from 'fs'
import readline from 'readline'
import { program } from 'commander'
import { ChatContext, handler } from './chat/chat'
import { completer } from './chat/completer'
import { replayChat } from './chat/history'
import { Message } from './messages/messages'
import { Provider } from './providers/provider'
import { createProvider, modelNames } from './providers/providers'
import { createInterruptHandler, InterruptHandler, InterruptHandlerOptions } from './util/interrupts'
import { createPrompter, Prompter } from './util/prompter'

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

    const system = `You are an assistant!`
    const provider = createProvider(model, system)
    await chatWithProvider(provider, model, historyFilename)
}

async function chatWithProvider(provider: Provider, model: string, historyFilename?: string) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer,
    })

    try {
        const interruptHandler = createInterruptHandler(rl)
        const prompter = createPrompter(rl, interruptHandler)
        const interruptInputOptions = rootInterruptHandlerOptions(rl)

        await interruptHandler.withInterruptHandler(
            () => chatWithReadline(interruptHandler, prompter, provider, model, historyFilename),
            interruptInputOptions,
        )
    } finally {
        rl.close()
    }
}

function rootInterruptHandlerOptions(rl: readline.Interface): InterruptHandlerOptions {
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

        rl.pause()
        process.stdout.write('^C')
        rl.resume()
        last = now
    }

    return {
        permanent: true,
        throwOnCancel: false,
        onAbort,
    }
}

async function chatWithReadline(
    interruptHandler: InterruptHandler,
    prompter: Prompter,
    provider: Provider,
    model: string,
    historyFilename?: string,
) {
    const context: ChatContext = {
        model,
        interruptHandler,
        prompter,
        provider,
    }

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

    console.log(`${historyFilename ? 'Resuming' : 'Beginning'} session with ${context.model}...\n`)
    await handler(context)
}

await main()
