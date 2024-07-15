import chalk from 'chalk';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { edit } from './editor.mjs';
import { CancelError, ExitError } from './errors.mjs';
import { formatBuffer, formatBufferError, formatBufferErrorWithPrefix, formatBufferWithPrefix } from './output.mjs';
import { withProgress } from './progress.mjs';
import { allMatches } from './regex.mjs';
import { createXmlPattern } from './xml.mjs';

export const commandDescriptions = [
    {
        prefix: ':help',
        handler: handleHelp,
        description: 'Show this message',
    },
    {
        prefix: ':exit',
        handler: handleExit,
        description: 'Exit the chat',
    },
    {
        prefix: ':clear',
        handler: handleClear,
        description: 'Clear the chat history',
    },
    {
        prefix: ':save',
        handler: handleSave,
        description: 'Save this chat history',
    },
    {
        prefix: ':load',
        args: true,
        handler: handleLoad,
        description: 'Load file contents into the chat context (supports wildcards)',
    },
    {
        prefix: ':run',
        args: true,
        handler: handleRun,
        description: 'Run a command in the shell',
    },
];

export async function handle(context, message) {
    if (message === '') {
        return;
    }

    if (message.startsWith(':')) {
        const parts = message.split(' ');
        const command = parts[0];
        const args = parts.slice(1).join(' ').trim();

        for (const { prefix, handler } of commandDescriptions) {
            if (command === prefix) {
                return handler(context, args);
            }
        }

        console.log(chalk.bold.red(`Unknown command prefix: ${command}.`));
        console.log();
        return;
    }

    return handleMessage(context, message);
}

async function handleHelp(context, message) {
    if (message !== '') {
        console.log(chalk.bold.red(`Unexpected arguments supplied to :help.`));
        console.log();
        return;
    }

    console.log();
    const maxWidth = commandDescriptions.reduce((max, { prefix }) => Math.max(max, prefix.length), 0);

    for (const { prefix, description } of commandDescriptions) {
        console.log(`${prefix.padEnd(maxWidth)} - ${description}`);
    }
    console.log();
}

async function handleExit(context, message) {
    if (message !== '') {
        console.log(chalk.bold.red(`Unexpected arguments supplied to :exit.`));
        console.log();
        return;
    }

    context.log('Goodbye!\n');
    throw new ExitError('User exited.');
}

async function handleClear(context) {
    if (message !== '') {
        console.log(chalk.bold.red(`Unexpected arguments supplied to :clear.`));
        console.log();
        return;
    }

    context.clearMessages();
    context.log('Chat history cleared.\n');
}

async function handleSave(context, message) {
    if (message !== '') {
        console.log(chalk.bold.red(`Unexpected arguments supplied to :save.`));
        console.log();
        return;
    }

    const filename = `chat-${Math.floor(Date.now() / 1000)}.json`;
    writeFileSync(filename, JSON.stringify(context.serialize(), null, '\t'));
    context.log(`Chat history saved to ${filename}\n`);
}

async function handleLoad(context, message) {
    if (message === '') {
        console.log(chalk.bold.red(`No paths supplied to :load.`));
        console.log();
        return;
    }

    await loadFiles(context, message.split(' ').filter(p => p.trim() !== ''));
}

async function loadFiles(context, patterns) {
    const paths = patterns.flatMap(pattern => glob.sync(pattern));
    const noun = paths.length === 1 ? paths[0] : `${paths.length} files`;

    const pathContents = [];
    const { ok } = await withProgress(async () => {
        for (const path of paths) {
            pathContents.push({path, contents: readFileSync(path, 'utf8')});
        }
    }, {
        log: context.log,
        progress: formatBufferWithPrefix(`Loading ${noun} into context...`),
        success: () => formatBuffer(`Loaded ${noun} into context${paths.length > 1 ? `: ${paths.join(', ')}` : '.'}`, ''),
        failure: formatBufferErrorWithPrefix(`Failed to load files into context.`),
    });

    if (ok) {
        for (const { path, contents } of pathContents) {
            context.pushUserMessage(`<AI:FILE path="${path}">${contents}</AI:FILE>\n`);
        }
    }
}

async function handleRun(context, message) {
    if (message === '') {
        console.log(chalk.bold.red(`No command supplied to :run.`));
        console.log();
        return;
    }

    context.log(`Executing command "${message}"...`, { silent: true });
    return runCode(context, message);
}

async function handleMessage(context, message) {
    const { ok, response } = await withProgress(progress => context.ask(message, { progress }), {
        log: context.log,
        progress: formatBufferWithPrefix('Generating response...'),
        success: formatBufferWithPrefix('Generated response.'),
        failure: formatBufferErrorWithPrefix('Failed to generate response.'),
    });

    if (ok) {
        const paths = unwrapContextRequest(response);
        const codeMatch = unwrapCode(response);
        const writes = unwrapWrites(response);
        // TODO - ensure mutual exclusion

        if (paths.length > 0) {
            await loadFiles(context, paths);
            context.log('$ ' + chalk.grey('<continuing conversation>'));
            return handleMessage(context, '');
        }
        if (codeMatch) {
            await handleCode(context, codeMatch);
        }
        if (writes.length > 0) {
            for (const { path, contents } of writes) {
                const resp = await context.prompter.options(`Write ${path}`, [
                    { name: 'y', description: 'write contents to disk' },
                    { name: 'n', description: 'do not write contents to disk', isDefault: true },
                ]);
                if (resp === 'y') {
                    writeFileSync(path, contents);
                    context.log(`Wrote contents to ${path}\n`);
                } else {
                    console.log();
                }
            }
        }
    }
}

function unwrapContextRequest(response) {
    return allMatches(response, createXmlPattern('AI:FILE_REQUEST', true)).flatMap(match => {
        return allMatches(match[2], createXmlPattern('AI:PATH', true)).map(match => match[2]);
    });
}

function unwrapCode(response) {
    const codeMatches = allMatches(response, createXmlPattern('AI:CODEBLOCK', true));
    if (codeMatches.length === 0) {
        return;
    }
    if (codeMatches.length === 1) {
        return codeMatches[0][2].trim();
    }

    console.log(chalk.dim('ℹ') + ' Multiple code blocks supplied, executing none of them.\n');
    return;
}

function unwrapWrites(response) {
    return allMatches(response, createXmlPattern('AI:FILE', true)).flatMap(match => ({
        path: /path="([^"]+)"/.exec(match[1])[1],
        contents: match[2].trim() + '\n',
    }));
}

async function handleCode(context, code) {
    const resp = await context.prompter.options('Execute this command', [
        { name: 'y', description: 'execute the command as-is' },
        { name: 'n', description: 'skip execution and continue conversation', isDefault: true },
        { name: 'e', description: 'edit this command in vscode' },
    ]);
    if (resp === 'y') {
        context.log('Executing command...', { silent: true });
        return runCode(context, code)
    }
    if (resp === 'e') {
        const { ok, response } = await withProgress(async (progress) => {
            progress(`<AI:CODEBLOCK>${(await edit(code)).trim()}</AI:CODEBLOCK>`);
        }, {
            log: context.log,
            progress: formatBufferWithPrefix('Editing code...'),
            success: formatBufferWithPrefix('Code edited.'),
            failure: (buffer, error) => error instanceof CancelError
                ? 'Edit canceled.'
                : formatBufferError('Failed to edit code.', buffer, error),
        });

        if (ok) {
            context.pushUserMessage(`Edited code to:\n${response}`);
            await handleCode(context, unwrapCode(response));
            return;
        }
    }

    context.log(chalk.dim('ℹ') + ' No code was executed.\n');
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
        log: context.log,
        progress: formatBufferWithPrefix('Executing command...'),
        success: formatBufferWithPrefix('Command succeeded.'),
        failure: formatBufferErrorWithPrefix('Command failed.'),
    });

    context.pushUserMessage(`Command ${ok ? 'succeeded' : 'failed'}.\nOutput:\n${response}\n`);

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
