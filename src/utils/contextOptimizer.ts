
export interface OptimizationOptions {
    removeComments: boolean;
    removeEmptyLines: boolean;
}

export function optimizeCode(code: string, languageId: string, options: OptimizationOptions): string {
    let output = code;

    // 1. Remove Comments
    if (options.removeComments) {
        // Safe Regex for C-style comments (// and /* */)
        // We use a callback to avoid potential issues with $1 replacement if groups are undefined
        output = output.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, (match, p1) => {
            if (p1 !== undefined) return p1; // Line comment, keep preceding char
            return ''; // Block comment, remove
        });
    }

    // 2. Remove Empty Lines (The "Safe" Compact)
    if (options.removeEmptyLines) {
        // Step A: Replace multiple newlines with a single newline (Removes vertical gaps)
        output = output.replace(/^\s*[\r\n]/gm, ''); 
        
        // Step B: Trim trailing whitespace on each line (Clean up)
        output = output.split('\n').map(line => line.trimEnd()).join('\n');
    }

    return output;
}
