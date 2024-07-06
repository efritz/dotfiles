import chalk from 'chalk';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { edit } from './codeEditor.mjs';
import { CancelError, ExitError } from './errors.mjs';
import { formatBuffer, formatBufferErrorWithPrefix, formatBufferWithPrefix } from './format.mjs';
import { withProgress } from './progress.mjs';

export const dispatch = [
    [/^help$/, handleHelp],
    [/^exit$/, handleExit],
    [/^clear$/, handleClear],
    [/^save$/, handleSave],
    [/^load (.+)$/, handleLoad],
    [/^(.*)$/, handleMessage],
];

async function handleHelp() {
    console.log('Commands:');
    console.log('  help - Show this message.');
    console.log('  exit - Exit the chat.');
    console.log('  clear - Clear the chat history.');
    console.log('  save - Save this chat history.');
    console.log('  load [<file>, ...] - load file contents into the chat context (supports wildcards)');
    console.log();
}

async function handleExit() {
    console.log('Goodbye!');
    console.log();

    throw new ExitError('User exited.');
}

async function handleClear(context) {
    context.clearMessages();
    console.log('Chat history cleared.');
    console.log();
}

async function handleSave(context) {
    const filename = `chat-${Math.floor(Date.now() / 1000)}.json`;
    writeFileSync(filename, JSON.stringify(context.serialize(), null, '\t'));
    console.log(`Chat history saved to ${filename}`);
    console.log();
}

async function handleLoad(context, userMessage, match) {
    const patterns = match[1].split(' ').filter(p => p.trim() !== '');
    const paths = patterns.flatMap(pattern => glob.sync(pattern));
    const noun = paths.length === 1 ? paths[0] : `${paths.length} files`;

    const pathContents = [];
    const { ok } = await withProgress(async () => {
        for (const path of paths) {
            pathContents.push({path, contents: readFileSync(path, 'utf8')});
        }
    }, {
        progress: formatBufferWithPrefix(`Loading ${noun} into context...`),
        success: () => formatBuffer(`Loaded ${noun} into context${paths.length > 1 ? `: ${paths.join(', ')}` : '.'}`, ''),
        failure: formatBufferErrorWithPrefix(`Failed to load files into context.`),
    });

    if (ok) {
        for (const { path, contents } of pathContents) {
            context.pushMessage(`<path>${path}</path><contents>${contents}</contents>\n`);
        }
    }
}

async function handleMessage(context, userMessage) {
    if (userMessage === '') {
        return;
    }

    const { ok, response } = await withProgress(progress => context.ask(userMessage, { progress }), {
        progress: formatBufferWithPrefix('Generating response...'),
        success: formatBufferWithPrefix('Generated response.'),
        failure: formatBufferErrorWithPrefix('Failed to generate response.'),
    });

    if (ok) {
        await handleCode(context, response);
    }
}

async function handleCode(context, response) {
    const codeMatch = response.match(/```shell([\s\S]*?)```/);
    if (!codeMatch) {
        return;
    }
    const code = codeMatch[1].trim();

    const resp = await context.prompter.options('Execute this command', [
        { name: 'y', description: 'execute the command as-is' },
        { name: 'n', description: 'skip execution and continue conversation', isDefault: true },
        { name: 'e', description: 'edit this command in vscode' },
    ]);
    if (resp === 'y') {
        return runCode(context, code)
    }
    if (resp === 'e') {
        const { ok, response: editedCodeWithFence } = await withProgress(async (progress) => {
            const editedCode = await edit(code);
            const codeWithFence = "```shell\n" + editedCode.trim() + "\n```\n"
            progress(codeWithFence);
            return codeWithFence;
        }, {
            progress: formatBufferWithPrefix('Editing code...'),
            success: formatBufferWithPrefix('Code edited.'),
            failure: (buffer, error) => error instanceof CancelError
                ? 'Edit canceled.'
                : formatBufferError('Failed to edit code.', buffer, error),
        });

        if (ok) {
            context.pushMessage(`Edited code to:\n${editedCodeWithFence}`);
            return handleCode(context, editedCodeWithFence);
        }
    }

    console.log(chalk.dim('ℹ') + ' No code was executed.');
    console.log();
    return;
}

async function runCode(context, code) {
    const { ok, response } = await withProgress(async (progress) => {
        await new Promise((resolve, reject) => {
            const cmd = spawn('zsh', ['-c', code]);
            cmd.stdout.on('data', data => progress(data.toString()));
            cmd.stderr.on('data', data => progress(data.toString()));

            cmd.on('exit', exitCode => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject(new Error(`exit code ${exitCode}`));
                }
            });
        });
    }, {
        progress: formatBufferWithPrefix('Executing command...'),
        success: formatBufferWithPrefix('Command succeeded.'),
        failure: formatBufferErrorWithPrefix('Command failed.'),
    });

    context.pushMessage(`Command ${ok ? 'succeeded' : 'failed'}.\nOutput:\n${response}\n`);

    if (!ok) {
        if ((await context.prompter.options('Diagnose error', [
            { name: 'y', description: 'diagnose this error', isDefault: true },
            { name: 'n', description: 'skip diagnosis and continue conversation'},
        ])) === 'y') {
            return handleMessage(context, 'Diagnose the error.');
        } else {
            console.log();
        }
    }
}
