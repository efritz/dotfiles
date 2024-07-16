import chalk from 'chalk';
import { allMatches } from './regex.mjs';
import { createXmlPartialClosingTagPattern, createXmlPartialOpeningTagPattern, createXmlPattern } from './xml.mjs';

export function formatBufferWithPrefix(prefix) {
    return buffer => formatBuffer(prefix, buffer);
}

export function formatBufferErrorWithPrefix(prefix) {
    return (buffer, error) => formatBufferError(prefix, buffer, error);
}

const partialTagPatterns = [
    'AI:THINKING',
    'AI:CODEBLOCK',
    'AI:FILE',
    'AI:FILE_REQUEST',
    'AI:PATH',
    'AI:COMPLETION',
].flatMap(name => [
    createXmlPartialOpeningTagPattern(name),
    createXmlPartialClosingTagPattern(name),
]);

const formattedPatterns = [
    {
        pattern: createXmlPattern('AI:THINKING'),
        formatter: (openingTag, content, closingTag) => {
            return chalk.italic.grey(content.trim());
        },
    },
    {
        pattern: createXmlPattern('AI:CODEBLOCK'),
        formatter: (openingTag, content, closingTag) => {
            return chalk.bold.magenta(content.trim());
        },
    },
    {
        pattern: createXmlPattern('AI:FILE'),
        formatter: (openingTag, content, closingTag) => {
            const path = /path="([^"]+)"/.exec(openingTag)[1];
            return chalk.red(`AI is requesting to write to the file "${chalk.bold(path)}":`) + '\n' + chalk.green(content.trim());
        },
    },
    {
        pattern: createXmlPattern('AI:FILE_REQUEST'),
        formatter: (openingTag, content, closingTag) => {
            const paths = allMatches(content, createXmlPattern('AI:PATH')).map(match => match[2].trim());
            return chalk.bold.blue('AI is requesting the following files:\n' + paths.map(path => `  - ${path}`).join('\n'));
        },
    },
    {
        pattern: createXmlPattern('AI:COMPLETION'),
        formatter: (openingTag, content, closingTag) => {
            const id = /id="([^"]+)"/.exec(openingTag)[1];
            return chalk.red(`AI has completed item "${chalk.bold(id)}":`) + '\n' + chalk.green(content.trim());
        },
    },
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
    formattedPatterns.forEach(({ pattern, formatter }) => {
        formatted = formatted.replace(pattern, (_, openTag, content, closingTag) => formatter(openTag, content, closingTag));
    });

    // Colorize all other output as cyan
    return prefix + '\n\n' + chalk.cyan(formatted);
}

export function formatBufferError(prefix, buffer, error) {
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
