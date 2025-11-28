
export function scrubSecrets(text: string): { cleanText: string, redactedCount: number } {
    const rules = [
        {
            name: 'AWS API Key',
            regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
            placeholder: '<REDACTED_AWS_KEY>'
        },
        {
            name: 'Generic Private Key',
            regex: /-----BEGIN [A-Z]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z]+ PRIVATE KEY-----/g,
            placeholder: '<REDACTED_PRIVATE_KEY>'
        },
        {
            name: 'Slack Token',
            regex: /xox[baprs]-([0-9a-zA-Z]{10,48})/g,
            placeholder: '<REDACTED_SLACK_TOKEN>'
        },
        {
            name: 'Generic Secret Assignment',
            // Matches: password = "..." or apiKey: "..." or secret = '...'
            // Capture group 1: key name (password|secret|token|key|pwd)
            // Capture group 2: separator
            // Capture group 3: quote
            // Capture group 4: value
            // Capture group 5: quote
            regex: /((?:password|secret|token|key|pwd|api_key)[a-zA-Z0-9_]*)\s*([:=])\s*(["'])(.*?)(["'])/gi,
            placeholder: '$1$2$3<REDACTED_SECRET>$5'
        }
    ];

    let cleanText = text;
    let totalRedacted = 0;

    rules.forEach(rule => {
        const matches = cleanText.match(rule.regex);
        if (matches) {
            totalRedacted += matches.length;
            cleanText = cleanText.replace(rule.regex, rule.placeholder);
        }
    });

    return { cleanText, redactedCount: totalRedacted };
}
