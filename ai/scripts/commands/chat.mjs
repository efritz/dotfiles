import readline from 'readline';
import { handle } from '../internal/chat.mjs';
import { completer } from '../internal/completions.mjs';
import { ExitError } from '../internal/errors.mjs';
import { createHistoryFromFile, createHistoryFromModel } from '../internal/history.mjs';
import { getPrompt } from '../internal/system.mjs';
import { createPrompter } from '../internal/prompt.mjs';
import { handleSigint } from '../internal/sigint.mjs';

const system = getPrompt('chat');
const metadata = async () => `
<system>
    <os>${(await $`uname`).stdout.trim()}</os>
    <shell>${(await $`$SHELL --version`).stdout.trim()}</shell>
</system>
`;

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

    const askerContext = historyFilename
        ? await createHistoryFromFile(historyFilename)
        : await createHistoryFromModel(model, system + '\n' + await metadata());

    const prompter = createPrompter(rl);

    askerContext.log(`Beginning session with ${model}...\n`);
    await handler({ ...askerContext, prompter });
    rl.close();
}

async function handler(context) {
    while (true) {
        const message = (await context.prompter.question('$ ')).trim();

        try {
            await handle(context, message);
        } catch (error) {
            if (error instanceof ExitError) {
                return;
            }

            throw error;
        }
    }
}
