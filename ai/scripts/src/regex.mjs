export function allMatches(text, pattern) {
    let match;
    const matches = [];
    while (match = pattern.exec(text)) {
        matches.push(match);
    }

    return matches;
}