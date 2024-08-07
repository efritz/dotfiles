import readline from 'readline'

export interface InterruptHandler {
    withInterruptHandler: <T>(
        readline: readline.Interface,
        handler: () => void,
        f: () => Promise<T>,
        permanent?: boolean,
    ) => Promise<T>
}

export function createInterruptHandler() {
    return {
        withInterruptHandler: async <T>(
            readline: readline.Interface,
            handler: () => void,
            f: () => Promise<T>,
            permanent = false,
        ): Promise<T> => {
            if (permanent) {
                readline.on('SIGINT', handler)
            } else {
                readline.once('SIGINT', handler)
            }

            try {
                return await f()
            } finally {
                readline.off('SIGINT', handler)
            }
        },
    }
}
