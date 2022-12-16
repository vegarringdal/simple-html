/**
 * takes and turn first letter to upper/rest lowercase and lower hyphen into space
 * @param text
 * @returns
 */
export function prettyPrintString(text: string) {
    const prettytext = text
        .split('_')
        .map((e) => e[0].toUpperCase() + e.substring(1, e.length).toLowerCase())
        .join(' ');
    return prettytext;
}
