import readline from 'readline';
import { readFileSync } from 'fs';
import { dispatch } from '../internal/chatHandlers.mjs';
import { ExitError } from '../internal/errors.mjs';
import { completeFilePaths } from '../internal/file.mjs';
import { createAsker, loadAskerFromHistoryFile } from '../internal/models.mjs';
import { createPrompter } from '../internal/prompt.mjs';
import { handleSigint } from '../internal/sigint.mjs';

const system = readFileSync('/Users/efritz/.dotfiles/ai/scripts/system_prompts/chat.txt', 'utf-8');

export async function chat(model, historyFilename) {
    if (!process.stdin.setRawMode) {
        throw new Error('chat command is not supported in this environment.');
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer: completeFilePaths,
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
