import { CompleterResult } from 'readline'
import { commands, completeCommand } from './commands/commands'

const commandPrefixes = commands.map(({ prefix, expectsArgs }) => prefix + (expectsArgs ? ' ' : ''))

export function completer(line: string): CompleterResult {
    const result = completeCommand(line)
    if (result) {
        return result
    }

    // Complete any meta command; if the line is empty show all meta commands.
    const hits = commandPrefixes.filter(completion => completion.startsWith(line))
    return [line === '' ? commandPrefixes : hits, line]
}
