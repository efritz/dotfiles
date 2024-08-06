import chalk from 'chalk'
import { AssistantMessage, Response } from '../messages/messages'

export function formatResponse(prefix: string, snapshot?: Response, error?: any): string {
    let content = (snapshot?.messages || [])
        .map(formatMessage)
        .filter(message => message !== '')
        .join('\n\n')

    if (error) {
        if (content) {
            content += '\n\n'
        }
        content += chalk.bold.red(`error: ${error.message}`)
    }

    if (content) {
        prefix += '\n\n'
    }
    return prefix + content
}

export function formatMessage(message: AssistantMessage): string {
    if (message.type === 'text') {
        const content = message.content.trim()
        if (content) {
            return chalk.cyan(content)
        }
    }

    return ''
}
