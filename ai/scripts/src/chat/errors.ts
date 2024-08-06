export class ExitError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ExitError'
    }
}
