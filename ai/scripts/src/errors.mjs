export class CancelError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CancelError';
    }
}

export class ExitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ExitError';
    }
}
