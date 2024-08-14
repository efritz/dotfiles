import { existsSync, readFileSync } from 'fs'
import { minimatch } from 'minimatch'

let ignoredPatterns: string[] | null = null

export function getIgnoredPatterns(): string[] {
    if (ignoredPatterns === null) {
        ignoredPatterns = loadIgnoreFile()
    }
    return ignoredPatterns
}

function loadIgnoreFile(): string[] {
    const ignoreFile = 'aidev.ignore'
    if (!existsSync(ignoreFile)) {
        return []
    }

    return readFileSync(ignoreFile, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
}

export function isIgnored(path: string): { ignored: boolean; pattern?: string } {
    const patterns = getIgnoredPatterns()
    let ignored = false
    let matchedPattern: string | undefined

    for (const pattern of patterns) {
        const isNegation = pattern.startsWith('!')
        const effectivePattern = isNegation ? pattern.slice(1) : pattern

        // Check if the pattern is meant for directories only
        const isDirectoryPattern = effectivePattern.endsWith('/')
        const matchOptions = { dot: true, matchBase: !effectivePattern.startsWith('/') }

        if (minimatch(path, effectivePattern, matchOptions)) {
            ignored = !isNegation
            matchedPattern = pattern

            // If it's a directory pattern, ensure the path is a directory
            if (isDirectoryPattern && !path.endsWith('/')) {
                continue
            }
        }
    }

    return { ignored, pattern: matchedPattern }
}
