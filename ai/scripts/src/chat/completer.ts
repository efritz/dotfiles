import { lstatSync } from 'fs'
import { homedir } from 'os'
import { CompleterResult } from 'readline'
import { glob } from 'glob'
import { commands } from './chat'

const commandPrefixes = commands.map(({ prefix, expectsArgs }) => prefix + (expectsArgs ? ' ' : ''))

export function completer(line: string): CompleterResult {
    if (line.startsWith(':load')) {
        // Expand files for loading that expand the last entry of the current list of files the user has provided. If a user has added a space to the previous file, we consider that "done" and won't suggest further expansion.

        const parts = line.split(' ')
        const lastEntry = parts[parts.length - 1]
        return [expandFilePath(lastEntry), lastEntry]
    }

    // Complete any meta command; if the line is empty show all meta commands.
    const hits = commandPrefixes.filter(completion => completion.startsWith(line))
    return [line === '' ? commandPrefixes : hits, line]
}

export function isDir(path: string): boolean {
    try {
        return lstatSync(path).isDirectory()
    } catch (e) {
        return false
    }
}

export function expandFilePath(lastEntry: string): string[] {
    let pathPrefix = lastEntry
    if (pathPrefix.startsWith('~')) {
        pathPrefix = homedir() + lastEntry.slice(1)
    }
    if (!pathPrefix.startsWith('/') && !pathPrefix.startsWith('./') && !pathPrefix.startsWith('../')) {
        pathPrefix = `./${pathPrefix}`
    }

    // TODO - update this with different glob functionality

    // Explicit glob - expand directly
    if (pathPrefix.includes('*')) {
        const entries = glob.sync(pathPrefix).filter(path => !isDir(path))
        if (entries.length === 0) {
            return []
        }

        // Return as a single completion to expand the user input into actual file paths.
        // Since this is a single element array, we'll end up adding it directly to the
        // user's input line.
        return [entries.join(' ') + ' ']
    }

    if (isDir(pathPrefix)) {
        // Ensure directories end in a slash before globbing below
        pathPrefix = pathPrefix.endsWith('/') ? pathPrefix : pathPrefix + '/'
    }

    // Use glob to expand paths by prefix in a single layer in the directory tree
    return (
        glob
            .sync(pathPrefix + '*')
            // Add a trailing slash to directories
            .map(path => `${path}${isDir(path) ? '/' : ''}`)
            // Do not complete directories to themselves
            .filter(path => !(path.endsWith('/') && path === pathPrefix))
    )
}
