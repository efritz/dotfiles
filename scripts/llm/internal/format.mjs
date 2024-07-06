import chalk from 'chalk';

export function formatBufferWithPrefix(prefix) {
    return buffer => formatBuffer(prefix, buffer);
}

export function formatBufferErrorWithPrefix(prefix) {
    return (buffer, error) => formatBufferError(prefix, buffer, error);
}

export function formatBuffer(prefix, buffer) {
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
