let sigintHandler = null;

export function setSigintHandler(handler) {
    sigintHandler = handler;
}

export function clearSigintHandler() {
    sigintHandler = null;
}

export function handleSigint() {
    if (!sigintHandler) {
        return false;
    }

    sigintHandler();
    return true;
}
