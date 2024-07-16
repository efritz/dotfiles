export function allMatches(text, pattern) {
    const matches = [];
    forEachMatch(text, pattern, match => matches.push(match));
    return matches;
}

export function forEachMatch(text, pattern, f) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
        f(match)
    }
}