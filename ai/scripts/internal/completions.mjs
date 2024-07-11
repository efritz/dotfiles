import { expandFilePath } from './files.mjs';

const commands = [
    ':help',
    ':exit',
    ':clear',
    ':save',
    ':load ',
];

export function completer(line) {
    if (line.startsWith(':load')) {
        // Expand files matching the last entry in this sequence
        const parts = line.split(' ');
        const lastEntry = parts[parts.length - 1];
        return [expandFilePath(lastEntry), lastEntry];
    }

    // Show all completions if none found
    const hits = commands.filter(completion => completion.startsWith(line));
    return [hits.length ? hits : commands, line];
}
