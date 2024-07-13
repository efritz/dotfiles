import chalk from 'chalk';
import { createXmlPartialClosingTagPattern, createXmlPartialOpeningTagPattern, createXmlPattern } from './xml.mjs';

export function formatBufferWithPrefix(prefix) {
    return buffer => formatBuffer(prefix, buffer);
}

export function formatBufferErrorWithPrefix(prefix) {
    return (buffer, error) => formatBufferError(prefix, buffer, error);
}

const partialTagPatterns = [
    'AI:CODEBLOCK',
].flatMap(name => [
    createXmlPartialOpeningTagPattern(name),
    createXmlPartialClosingTagPattern(name),
]);

const colorizedPatterns = [
    { pattern: createXmlPattern('AI:CODEBLOCK'), colorizer: chalk.bold.magenta },
];

export function formatBuffer(prefix, buffer) {
    let formatted = buffer.trim();
    if (formatted === '') {
        return prefix;
    }

    // Remove opening and closing tags that haven't been completely omitted.
    // This stops us from "flashing" tags that will be removed once completed.
    // This also helps us deal with an easier pattern in the next steps where
    // we want to colorize partial output that doesn't yet have a closing tag.
    partialTagPatterns.forEach(pattern => {
        formatted = formatted.replace(pattern, '');
    });

    // Colorize finished or partially opened blocks
    colorizedPatterns.forEach(({ pattern, colorizer }) => {
        formatted = formatted.replace(pattern, (_, openTag, content, closingTag) => {
            return colorizer(content.trim());
        });
    });

    // Colorize all other output as cyan
    return prefix + '\n\n' + chalk.cyan(formatted);
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
