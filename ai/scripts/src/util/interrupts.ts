import readline from 'readline'

export interface InterruptHandler {
    withInterruptHandler: <T>(handler: () => void, f: () => Promise<T>, permanent?: boolean) => Promise<T>
}

export function createInterruptHandler(readline: readline.Interface) {
    return {
        withInterruptHandler: async <T>(handler: () => void, f: () => Promise<T>, permanent = false): Promise<T> => {
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
