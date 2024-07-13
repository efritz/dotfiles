import { commandDescriptions } from './chat.mjs';
import { expandFilePath } from './files.mjs';

const commands = commandDescriptions.map(({ prefix, args }) => prefix + (args ? ' ' : ''));

export function completer(line) {
    if (line.startsWith(':load')) {
        // Expand files for loading that expand the last entry of the
        // current list of files the user has provided. If a user has
        // added a space to the previous file, we consider that "done"
        // and won't suggest further expansion.

        const parts = line.split(' ');
        const lastEntry = parts[parts.length - 1];
        return [expandFilePath(lastEntry), lastEntry];
    }

    // Complete any meta command; if the line is empty show all meta commands.
    const hits = commands.filter(completion => completion.startsWith(line));
    return [hits.length ? hits : commands, line];
}
