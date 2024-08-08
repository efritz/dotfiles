import { homedir } from 'os'
import { CompleterResult } from 'readline'
import { expandFilePatterns, expandPrefixes } from '../util/fs/glob'
import { commands } from './commands/commands'

export function completer(line: string): CompleterResult {
    return !line.startsWith(':load') ? completeCommand(line) : completeLoad(line)
}

const commandPrefixes = commands.map(({ prefix, expectsArgs }) => prefix + (expectsArgs ? ' ' : ''))

// Complete any meta command; if the line is empty show all meta commands.
function completeCommand(line: string): CompleterResult {
    const hits = commandPrefixes.filter(completion => completion.startsWith(line))
    return [line === '' ? commandPrefixes : hits, line]
}

// Expand files for loading that expand the last entry of the current list of files
// the user has provided. If a user has added a space to the previous file, we consider
// that "done" and won't suggest further expansion.
function completeLoad(line: string): CompleterResult {
    const last = line.split(' ').pop()!
    const prefix = canonicalizePathPrefix(last)

    if (prefix.includes('*')) {
        const entries = expandFilePatterns([prefix])
        if (entries.length === 0) {
            return [[], last]
        }

        // If there are any matches, return a SINGLE result as a string with a trailing space.
        // THis will replace the entry with the expanded paths, rather than simply suggesting
        // all of them for individual selection.
        return [[entries.join(' ') + ' '], last]
    }

    return [expandPrefixes([prefix]), last]
}

function canonicalizePathPrefix(prefix: string): string {
    // Support home directory
    if (prefix.startsWith('~')) {
        prefix = homedir() + prefix.slice(1)
    }

    // Canonicalize relative paths
    if (!prefix.startsWith('/') && !prefix.startsWith('./') && !prefix.startsWith('../')) {
        prefix = `./${prefix}`
    }

    return prefix
}
