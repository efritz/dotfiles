import chalk from 'chalk';
import chokidar from 'chokidar';
import readline from 'readline';
import ora from 'ora';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { lstatSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { createAsker, loadAskerFromHistoryFile } from '../common/ask.mjs';

const system = `
<assistant_info>
You are an assistant being used in a terminal.
</assistant_info>

<modes>
<mode>answer</mode>
<description>
This is the default mode and should be selected unless the user is asking for an action solvable by terminal commands.
Be concise as possible without losing information and avoid unnecessary pleasantries.
Always answer the user's questions intelligently and truthfully.
</description>

<mode>execute</mode>
<description>
This mode should be used when the user asks you to perform a task.
Reply with only a shell script that performs that task wrapped inside a markdown code block formatted as:

\`\`\`shell
code to execute here
\`\`\`

Do not offer any explanatory text along with the code.
When asked to write/modify a file, provide a shell command to do it instead of just showing the file contents.
When asked to query an API, write a shell command to make the request.
Always assume common commands/tools are available. Don't write install commands unless explicitly requested.
</description>

<mode>diagnose</mode>
<description>
This mode should be used when the user asks you to diagnose an error from a previous shell command.
Reply with an update shell script as you would in the execute mode.
</description>
</modes>
`

let sigintHandler;

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
        if (sigintHandler) {
            sigintHandler();
        } else {
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

const dispatch = [
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
    console.log('  load <file> - load file contents into the chat context');
    console.log();
}

class ExitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ExitError';
    }
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
    const paths = match[1].split(' ').filter(p => p.trim() !== '');
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

async function withProgress(f, options) {
    let buffer = '';
    const spinner = ora({ text: options.progress(''), discardStdin: false });
    spinner.start();

    try {
        await f(chunk => {
            buffer += chunk;
            spinner.text = options.progress(buffer);
        });

        spinner.succeed(options.success(buffer));
        return { ok: true, response: buffer };
    } catch (error) {
        spinner.fail(options.failure(buffer, error));
        return { ok: false, response: buffer };
    } finally {
        console.log();
    }
}

function formatBufferWithPrefix(prefix) {
    return buffer => formatBuffer(prefix, buffer);
}

function formatBufferErrorWithPrefix(prefix) {
    return (buffer, error) => formatBufferError(prefix, buffer, error);
}

function formatBuffer(prefix, buffer) {
    const context = chalk.cyan(buffer.trim().replace(/(```shell)([\s\S]*?)(```|$)/g, (_, left, code, right) => {
        return left + chalk.bold.magenta(code) + right;
    }));

    if (context === '') {
        return prefix;
    }

    return prefix + '\n\n' + context;
}

function formatBufferError(prefix, buffer, error) {
    let context = '';
    if (error && error.message) {
        context = chalk.bold.red(`error: ${error.message}`);
    }

    const trimmedBuffer = buffer.trim();
    if (trimmedBuffer !== '') {
        if (context !== '') {
            context += '\n\n';
        }

        context += chalk.red(trimmedBuffer);
    }

    if (context === '') {
        return prefix;
    }

    return prefix + '\n\n' + context;
}

function createPrompter(rl) {
    const question = async (prompt) => {
        return new Promise((resolve) => rl.question(prompt, resolve));
    };

    const options = async (prompt, options) => {
        const help = { name: '?', description: 'print help' };
        const name = o => o.isDefault ? o.name.toUpperCase() : o.name.toLowerCase();
        const optionNames = [...options, help].map(o => name(o)).join('/');
        const helpText = [...options, help].map(o => `${name(o)} - ${o.description}`).join('\n');

        while (true) {
            const value = await question(chalk.cyanBright(`${prompt} [${optionNames}]? `));

            const option = options.find(o =>
                (value === '' && o.isDefault) ||
                (value !== '' && o.name.toLowerCase() === value[0].toLowerCase())
            );
            if (option) {
                return option.name;
            }

            console.log(chalk.bold.red(helpText));
        }
    }

    return {
        question,
        options,
    };
}

function isDir(path) {
    return lstatSync(path).isDirectory();
}

function readDir(dirname) {
    try {
        return readdirSync(dirname)
            .map(path => `${dirname}/${path}`)
            .map(path => `${path}${isDir(path) ? '/' : ''}`);
    } catch (e) {
        return [];
    }
}

function trimSlash(path) {
    return path.endsWith('/') ? path.slice(0, -1) : path;
}

function completePath(path) {
    let pathPrefix = path;
    if (pathPrefix.startsWith('~')) {
        pathPrefix = homedir() + path.slice(1);
    }
    if (!pathPrefix.startsWith('/') && !pathPrefix.startsWith('./') && !pathPrefix.startsWith('../')) {
        pathPrefix = `./${pathPrefix}`;
    }

    const index = pathPrefix.lastIndexOf('/');
    const dirname = index < 0 ? '.' : pathPrefix.substring(0, index);
    const dirs = [...new Set([dirname, pathPrefix].map(trimSlash))];
    const entries = dirs.flatMap(readDir);
    return entries.filter(path =>
        path.startsWith(pathPrefix) &&
        // Do not complete directories to themselves
        !(path.endsWith('/') && path === pathPrefix)
    );
}

function completer(line) {
    const parts = line.split(' ');
    if (parts[0] !== 'load') {
        return [[], line];
    }

    const prefix = parts[parts.length - 1];
    return [completePath(prefix), prefix];
}

class CancelError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CancelError';
    }
}

function edit(content) {
    const suffix = randomBytes(16).toString('hex');
    const tempPath = `/tmp/llm-chat-code-${suffix}`;
    writeFileSync(tempPath, content);

    const watcher = chokidar.watch(tempPath, {
        persistent: true,
        ignoreInitial: true,
    });

    return new Promise((resolve, reject) => {
        sigintHandler = () => {
            reject(new CancelError('User canceled edit'))
        };

        watcher.on('change', () => {
            const newContent = readFileSync(tempPath, 'utf-8');
            if (newContent !== content) {
                resolve(newContent);
            }
        });

        const editor = $`e ${tempPath}`;
        editor.catch((error) => reject(new Error(`Failed to open editor: ${error.message}`)));
    }).finally(() => {
        watcher.close();
        unlinkSync(tempPath);
        sigintHandler = null;
    });
}
