const path = require('path');

// Mock path for Windows behavior if running on linux container, but User is Windows.
// Actually, let's just use forward slashes for simplicity in this script or try to use path.win32 if available.
// The user is on Windows, so path.sep is likely '\'.

const mockPaths = [
    'C:\\Users\\Lih Sheng\\Project\\src\\components\\Button.ts',
    'C:\\Users\\Lih Sheng\\Project\\src\\components\\Header.ts',
    'C:\\Users\\Lih Sheng\\Project\\src\\utils\\helper.ts'
];

const workspaceRoot = 'C:\\Users\\Lih Sheng\\Project';

function getCommonAncestor(paths) {
    if (paths.length === 0) return '';
    if (paths.length === 1) return path.dirname(paths[0]);
    
    const sep = '\\'; // Hardcoded for Windows simulation
    const parts = paths.map(p => p.split(sep));
    const minLength = Math.min(...parts.map(p => p.length));
    let i = 0;
    while (i < minLength) {
        const val = parts[0][i];
        if (parts.every(p => p[i] === val)) {
            i++;
        } else {
            break;
        }
    }
    return parts[0].slice(0, i).join(sep);
}

function renderTree(node, prefix = '') {
    let output = '';
    const keys = Object.keys(node).sort();
    
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const isLast = i === keys.length - 1;
        const children = node[key];
        const hasChildren = Object.keys(children).length > 0;
        
        output += `${prefix}${isLast ? '└── ' : '├── '}${key}\n`;
        
        if (hasChildren) {
            output += renderTree(children, prefix + (isLast ? '    ' : '│   '));
        }
    }
    return output;
}

function generateTree(paths, rootPath) {
    const relativePaths = paths.map(p => p.replace(rootPath + '\\', ''));
    
    const relativeRoot = {};
    for (const p of relativePaths) {
        const parts = p.split('\\');
        let current = relativeRoot;
        for (const part of parts) {
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
    }

    return `Root: ${rootPath}\n` + renderTree(relativeRoot);
}

console.log('--- Current Logic (Common Ancestor) ---');
const commonAncestor = getCommonAncestor(mockPaths);
console.log(generateTree(mockPaths, commonAncestor));

console.log('\n--- Proposed Logic (Workspace Root) ---');
console.log(generateTree(mockPaths, workspaceRoot));
