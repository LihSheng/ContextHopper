
export interface OptimizationOptions {
    removeComments: boolean;
    removeEmptyLines: boolean;
}

export function optimizeCode(code: string, languageId: string, options: OptimizationOptions): string {
    let output = code;

    // 1. Remove Comments
    if (options.removeComments) {
        // Safe Regex for C-style comments (// and /* */)
        // Note: This is a simplified regex as requested. For production-grade comment removal, 
        // a parser or more complex regex is usually needed to handle strings correctly.
        // However, we are sticking to the user's requested logic for now.
        output = output.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
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
