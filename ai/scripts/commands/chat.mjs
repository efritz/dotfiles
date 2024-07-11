import readline from 'readline';
import { dispatch } from '../internal/chat.mjs';
import { ExitError } from '../internal/errors.mjs';
import { completer } from '../internal/completions.mjs';
import { createAsker, loadAskerFromHistoryFile } from '../internal/models.mjs';
import { getPrompt } from '../internal/system.mjs';
import { createPrompter } from '../internal/prompt.mjs';
import { handleSigint } from '../internal/sigint.mjs';

const system = getPrompt('chat');

export async function chat(model, historyFilename) {
    if (!process.stdin.setRawMode) {
        throw new Error('chat command is not supported in this environment.');
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer,
    });

    rl.on('SIGINT', () => {
        if (!handleSigint()) {
            rl.pause();
        }
    });

    const { ask, pushMessage, clearMessages, serialize } = historyFilename
        ? await loadAskerFromHistoryFile(historyFilename)
        : await createAsker(model, system);

    const prompter = createPrompter(rl);

    console.log(`Chatting with ${model}...\n`);
    await handler({ ask, pushMessage, clearMessages, serialize, prompter });
    rl.close();
}

async function handler(context) {
    loop: while (true) {
        const userMessage = (await context.prompter.question('$ ')).trim();

        for (const [pattern, handler] of dispatch) {
            const match = userMessage.match(pattern);
            if (!match) {
                continue;
            }

            try {
                await handler(context, userMessage, match);
                continue loop;
            } catch (error) {
                if (error instanceof ExitError) {
                    return;
                }

                throw error;
            }
        }

        throw new Error(`No pattern matched message: ${userMessage}.`);
    }
}
