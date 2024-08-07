import readline from 'readline'

export interface InterruptHandler {
    withInterruptHandler: <T>(f: () => Promise<T>, options?: InterruptHandlerOptions) => Promise<T>
}

export type InterruptHandlerOptions = {
    onAbort?: () => void
    permanent?: boolean
}

export function createInterruptHandler(readline: readline.Interface) {
    return {
        withInterruptHandler: async <T>(
            f: () => Promise<T>,
            { onAbort, permanent = false }: InterruptHandlerOptions = {},
        ): Promise<T> => {
            const abort = () => onAbort?.()

            if (permanent) {
                readline.on('SIGINT', abort)
            } else {
                readline.once('SIGINT', abort)
            }

            try {
                return await f()
            } finally {
                readline.off('SIGINT', abort)
            }
        },
    }
}
