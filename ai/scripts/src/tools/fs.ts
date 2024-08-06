import { Dirent, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { readdir } from 'fs/promises'
import chalk from 'chalk'
//
//

import * as diffLib from 'diff'
import {
    DirectoryPayload,
    expandDirectoryPatterns,
    expandFilePatterns,
    FilePayload,
    readDirectoryContents,
    readFileContents,
} from '../util/fs'
import { withProgress } from '../util/progress'
import { Arguments, ExecutionContext, ExecutionResult, Tool, ToolResult } from './tool'

export const readDirectories: Tool = {
    name: 'read_directories',
    description: 'Add contents of directories into the context.',
    parameters: {
        type: 'object',
        properties: {
            paths: {
                type: 'array',
                description: 'A list of directory paths to read.',
                items: { type: 'string' },
            },
        },
        required: ['paths'],
    },
    replay: (args: Arguments, result: ToolResult) => {
        const { paths } = args as { paths: string[] }

        for (const path of paths) {
            console.log(`${chalk.dim('ℹ')} Read directory "${chalk.red(path)}" into context.`)
        }
    },
    execute: async (context: ExecutionContext, args: Arguments): Promise<ExecutionResult> => {
        const { paths: patterns } = args as { paths: string[] }
        const result = await readDirectoryContents(expandDirectoryPatterns(patterns))

        if (result.ok) {
            return { result: result.response, reprompt: true }
        } else {
            return { error: result.error }
        }
    },
    serialize: (result?: any) => JSON.stringify(result as DirectoryPayload[]),
}

export const readFiles: Tool = {
    name: 'read_files',
    description: 'Add contents of files into the context.',
    parameters: {
        type: 'object',
        properties: {
            paths: {
                type: 'array',
                description: 'A list of file paths to read.',
                items: { type: 'string' },
            },
        },
        required: ['paths'],
    },
    replay: (args: Arguments, result: ToolResult) => {
        const { paths } = args as { paths: string[] }

        for (const path of paths) {
            console.log(`${chalk.dim('ℹ')} Read file "${chalk.red(path)}" into context.`)
        }
    },
    execute: async (context: ExecutionContext, args: Arguments): Promise<ExecutionResult> => {
        const { paths: patterns } = args as { paths: string[] }
        const result = await readFileContents(expandFilePatterns(patterns))

        if (result.ok) {
            return { result: JSON.stringify(result.response), reprompt: true }
        } else {
            return { error: result.error }
        }
    },
    serialize: (result?: any) => JSON.stringify(result as FilePayload[]),
}

export const writeFile: Tool = {
    name: 'write_file',
    description: 'Write file content to disk.',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The target path.',
            },
            contents: {
                type: 'string',
                description: 'The contents of the file.',
            },
        },
        required: ['path, contents'],
    },
    replay: (args: Arguments, result: ToolResult) => {
        const { path, contents } = args as { path: string; contents: string }

        console.log(`${chalk.dim('ℹ')} Wrote file "${chalk.red(path)}":`)
        console.log()
        console.log(formatContent(contents))
    },
    execute: async (context: ExecutionContext, args: Arguments): Promise<ExecutionResult> => {
        const { path, contents } = args as { path: string; contents: string }

        console.log(formatContent(contents))

        if (await confirmWrite(context, path, contents)) {
            writeFileSync(path, contents)
            console.log(`${chalk.dim('ℹ')} Wrote file.`)
            return { result: { userCanceled: false } }
        } else {
            console.log(chalk.dim('ℹ') + ' No file was written.\n')
            return { result: { userCanceled: true } }
        }
    },
    serialize: (result?: any) => JSON.stringify(result as { userCanceled: Boolean }),
}

async function confirmWrite(context: ExecutionContext, path: string, contents: string): Promise<boolean> {
    while (true) {
        const result = await context.prompter.options(`Write contents to "${path}"`, [
            {
                name: 'y',
                description: 'write file to disk',
                handler: async () => true,
            },
            {
                name: 'n',
                description: 'skip write and continue conversation',
                isDefault: true,
                handler: async () => false,
            },
            {
                name: 'd',
                description: 'show file diff',
                handler: async () => {
                    await showDiff(context, path, contents)
                    return undefined
                },
            },
        ])

        if (result !== undefined) {
            return result
        }
    }
}

function formatContent(contents: string): string {
    return contents
        .split('\n')
        .map(line => `> ${chalk.red(line)}`)
        .join('\n')
}

async function showDiff(context: ExecutionContext, path: string, newContents: string) {
    if (!existsSync(path)) {
        console.log(chalk.yellow(`File ${path} does not exist. Creating a new file.`))
        console.log(chalk.green('New file contents:'))
        console.log(newContents)
        return
    }

    const oldContents = readFileSync(path, 'utf8')

    console.log(chalk.cyan(`Diff for ${path}:`))
    await displayDiffBlocks(context, createDiffBlocks(oldContents, newContents))
}

function createDiffBlocks(oldContents: string, newContents: string): string[] {
    const diff = diffLib.diffLines(oldContents, newContents)
    const blocks = []
    let currentBlock: string[] = []
    let unchangedLines = 0
    const contextLines = 3

    diff.forEach((part, index) => {
        const lines = part.value.trim().split('\n')

        if (part.added || part.removed) {
            if (unchangedLines > 0) {
                currentBlock.push(
                    ...formatUnchangedLines(diff[index - 1].value.trim().split('\n').slice(-contextLines)),
                )
            }
            unchangedLines = 0

            lines.forEach(line => {
                if (part.added) {
                    currentBlock.push(chalk.green(`+ ${line}`))
                } else {
                    currentBlock.push(chalk.red(`- ${line}`))
                }
            })
        } else {
            unchangedLines += lines.length
            if (unchangedLines > contextLines * 2) {
                if (currentBlock.length > 0) {
                    currentBlock.push(...formatUnchangedLines(lines.slice(0, contextLines)))
                    blocks.push(currentBlock.join('\n'))
                    currentBlock = []
                }
            } else {
                currentBlock.push(...formatUnchangedLines(lines))
            }
        }
    })

    if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'))
    }

    return blocks
}

function formatUnchangedLines(lines: string[]): string[] {
    return lines.map(line => chalk.gray(`  ${line}`))
}

async function displayDiffBlocks(context: ExecutionContext, blocks: string[]) {
    let current = 0
    while (current < blocks.length) {
        console.log(blocks[current])
        console.log(chalk.yellow(`\nBlock ${current + 1} of ${blocks.length}`))

        const hasPrev = current > 0
        const hasNext = current < blocks.length - 1

        // TODO - make this a shorthand
        const answer = await context.prompter.options('Diff navigation', [
            ...(hasNext ? [{ name: 'n', description: 'Next block', isDefault: true, handler: async () => 'n' }] : []),
            ...(hasPrev ? [{ name: 'p', description: 'Previous block', handler: async () => 'p' }] : []),
            ...[{ name: 'q', description: 'Quit', isDefault: !hasNext, handler: async () => 'q' }],
        ])

        if (answer === 'q') {
            break
        } else if (answer === 'n') {
            current++
        } else if (answer === 'p') {
            current--
        }
    }
}
