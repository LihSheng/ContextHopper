import * as vscode from 'vscode';
import * as path from 'path';
import { encodingForModel } from 'js-tiktoken';
import { scrubSecrets } from './utils/secretScrubber';
import { optimizeCode, OptimizationOptions } from './utils/contextOptimizer';

export interface ContextItem {
    id: string;
    type: 'file' | 'text';
    content: string; // File path or text content
    label?: string;
    languageId?: string;
    range?: { start: number; end: number }; // Line numbers (0-indexed)
    tokens?: number;
}

export class ContextWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'context-hopper-view';

    private _view?: vscode.WebviewView;
    private _items: ContextItem[] = [];
    private _enc = encodingForModel('gpt-4');
    private _optimizationSettings: OptimizationOptions = {
        removeComments: false,
        removeEmptyLines: false
    };

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        // Load persisted items
        const savedItems = this._context.workspaceState.get<ContextItem[]>('context-hopper-items');
        if (savedItems) {
            this._items = savedItems;
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Send initial settings and items
        setTimeout(() => {
             webviewView.webview.postMessage({ type: 'update-optimization-settings', settings: this._optimizationSettings });
             this._updateWebview();
        }, 500);

        // Sync when view becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._updateWebview();
            }
        });

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'delete-item':
                    this.removeItem(data.id);
                    break;
                case 'delete-items':
                    this.removeItems(data.ids);
                    break;
                case 'reorder-items':
                    this.reorderItems(data.items);
                    break;
                case 'add-note':
                    this.addNote(data.text);
                    break;
                case 'open-file':
                    this.openFile(data.path, data.range);
                    break;
                case 'copy-all':
                    this.copyAll();
                    break;
                case 'copy-items':
                    this.copyItems(data.ids);
                    break;
                case 'clear-all':
                    this.clearAll();
                    break;
                case 'toggle-optimization':
                    this.toggleOptimization(data.setting, data.value);
                    break;
                case 'open-optimization-menu':
                    this.openOptimizationMenu();
                    break;
            }
        });
    }

    public addItem(item: ContextItem) {
        // Deduplication: Check if item with same content (path) already exists
        const exists = this._items.some(existing => 
            existing.type === 'file' && 
            item.type === 'file' && 
            existing.content === item.content
        );

        if (!exists) {
            this._items.push(item);
            this._saveState();
            this._updateWebview();
        }
    }

    private removeItem(id: string) {
        this._items = this._items.filter(x => x.id !== id);
        this._saveState();
        this._updateWebview();
    }

    private removeItems(ids: string[]) {
        this._items = this._items.filter(x => !ids.includes(x.id));
        this._saveState();
        this._updateWebview();
    }

    private reorderItems(newOrderIds: string[]) {
        const newItems: ContextItem[] = [];
        for (const id of newOrderIds) {
            const item = this._items.find(x => x.id === id);
            if (item) {
                newItems.push(item);
            }
        }
        this._items = newItems;
        this._saveState();
        this._updateWebview(); // Optional, mainly to sync state if needed
    }

    private addNote(text: string) {
        const item: ContextItem = {
            id: Date.now().toString(),
            type: 'text',
            content: text,
            tokens: this._enc.encode(text).length
        };
        this._items.push(item);
        this._saveState();
        this._updateWebview();
    }

    private async toggleOptimization(setting: keyof OptimizationOptions, value: boolean) {
        this._optimizationSettings[setting] = value;
        await this._recalculateTokens();
        this._updateWebview();
        // Also update settings in UI
        if (this._view) {
             this._view.webview.postMessage({ type: 'update-optimization-settings', settings: this._optimizationSettings });
        }
    }

    private async openOptimizationMenu() {
        const items: vscode.QuickPickItem[] = [
            {
                label: '$(comment-discussion) Remove Comments',
                picked: this._optimizationSettings.removeComments,
                description: 'Strip comments from code'
            },
            {
                label: '$(fold-up) Remove Empty Lines',
                picked: this._optimizationSettings.removeEmptyLines,
                description: 'Remove vertical whitespace (Safe)'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select optimizations to apply'
        });

        if (selected) {
            const newSettings: OptimizationOptions = {
                removeComments: selected.some(i => i.label.includes('Remove Comments')),
                removeEmptyLines: selected.some(i => i.label.includes('Remove Empty Lines'))
            };
            
            this._optimizationSettings = newSettings;
            await this._recalculateTokens();
            this._updateWebview();
             if (this._view) {
                 this._view.webview.postMessage({ type: 'update-optimization-settings', settings: this._optimizationSettings });
            }
        }
    }

    private async _recalculateTokens() {
        for (const item of this._items) {
            if (item.type === 'file') {
                try {
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(item.content));
                    let text = '';
                    if (item.range) {
                        const range = new vscode.Range(item.range.start, 0, item.range.end, 1000);
                        text = doc.getText(range);
                    } else {
                        text = doc.getText();
                    }
                    
                    // Apply optimizations for token calculation
                    const optimized = optimizeCode(text, item.languageId || 'plaintext', this._optimizationSettings);
                    item.tokens = this._enc.encode(optimized).length;
                } catch (e) {
                    console.error('Error recalculating tokens:', e);
                }
            } else if (item.type === 'text') {
                 // Optimize notes too? Maybe just whitespace.
                 let text = item.content;
                 if (this._optimizationSettings.removeEmptyLines) {
                     text = text.replace(/^\s*[\r\n]/gm, '').replace(/\n{3,}/g, '\n\n').trim();
                 }
                 item.tokens = this._enc.encode(text).length;
            }
        }
    }

    private openFile(filePath: string, range?: { start: number; end: number }) {
        const uri = vscode.Uri.file(filePath);
        const options: vscode.TextDocumentShowOptions = {};
        if (range) {
            options.selection = new vscode.Range(range.start, 0, range.end, 0);
        }
        vscode.commands.executeCommand('vscode.open', uri, options);
    }

    public async copyAll() {
        let content = '';
        for (const item of this._items) {
            if (item.type === 'file') {
                try {
                    const uri = vscode.Uri.file(item.content);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    let fileContent = '';
                    
                    content += `\n// File: ${path.basename(item.content)}\n`;
                    content += `// Path: ${item.content}\n`;
                    
                    if (item.range) {
                        content += `// Lines: ${item.range.start + 1}-${item.range.end + 1}\n`;
                        const range = new vscode.Range(item.range.start, 0, item.range.end, 1000); 
                        fileContent = doc.getText(range);
                    } else {
                        fileContent = doc.getText();
                    }

                    // Optimize
                    fileContent = optimizeCode(fileContent, item.languageId || 'plaintext', this._optimizationSettings);
                    content += fileContent + '\n';

                } catch (e) {
                    content += `\n// Error reading file: ${item.content}\n`;
                }
            } else if (item.type === 'text') {
                let noteContent = item.content;
                if (this._optimizationSettings.removeEmptyLines) {
                     noteContent = noteContent.replace(/^\s*[\r\n]/gm, '').replace(/\n{3,}/g, '\n\n').trim();
                }
                content += `\n// Note:\n${noteContent}\n`;
            }
        }

        // Secret Scrubbing
        const config = vscode.workspace.getConfiguration('contextHopper');
        const redactSecrets = config.get<boolean>('redactSecrets', true);
        let finalContent = content;
        let redactedMsg = '';

        if (redactSecrets) {
            const result = scrubSecrets(content);
            finalContent = result.cleanText;
            if (result.redactedCount > 0) {
                redactedMsg = ` (Redacted ${result.redactedCount} secrets)`;
            }
        }

        await vscode.env.clipboard.writeText(finalContent);
        vscode.window.showInformationMessage(`Copied ${this._items.length} items to clipboard.${redactedMsg}`);
    }

    public async copyItems(ids: string[]) {
        const itemsToCopy = this._items.filter(x => ids.includes(x.id));
        if (itemsToCopy.length === 0) return;

        let content = '';
        for (const item of itemsToCopy) {
            if (item.type === 'file') {
                try {
                    const uri = vscode.Uri.file(item.content);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    let fileContent = '';
                    
                    content += `\n// File: ${path.basename(item.content)}\n`;
                    content += `// Path: ${item.content}\n`;
                    
                    if (item.range) {
                        content += `// Lines: ${item.range.start + 1}-${item.range.end + 1}\n`;
                        const range = new vscode.Range(item.range.start, 0, item.range.end, 1000); 
                        fileContent = doc.getText(range);
                    } else {
                        fileContent = doc.getText();
                    }

                    // Optimize
                    fileContent = optimizeCode(fileContent, item.languageId || 'plaintext', this._optimizationSettings);
                    content += fileContent + '\n';

                } catch (e) {
                    content += `\n// Error reading file: ${item.content}\n`;
                }
            } else if (item.type === 'text') {
                let noteContent = item.content;
                if (this._optimizationSettings.removeEmptyLines) {
                     noteContent = noteContent.replace(/^\s*[\r\n]/gm, '').replace(/\n{3,}/g, '\n\n').trim();
                }
                content += `\n// Note:\n${noteContent}\n`;
            }
        }

        // Secret Scrubbing
        const config = vscode.workspace.getConfiguration('contextHopper');
        const redactSecrets = config.get<boolean>('redactSecrets', true);
        let finalContent = content;
        let redactedMsg = '';

        if (redactSecrets) {
            const result = scrubSecrets(content);
            finalContent = result.cleanText;
            if (result.redactedCount > 0) {
                redactedMsg = ` (Redacted ${result.redactedCount} secrets)`;
            }
        }

        await vscode.env.clipboard.writeText(finalContent);
        vscode.window.showInformationMessage(`Copied ${itemsToCopy.length} items to clipboard.${redactedMsg}`);
    }

    public addFileStructure() {
        const fileItems = this._items.filter(item => item.type === 'file');
        if (fileItems.length === 0) {
            vscode.window.showInformationMessage('No file items to generate structure from.');
            return;
        }

        const filePaths = fileItems.map(item => item.content);
        const tree = this._generateTree(filePaths);
        
        this.addNote(`File Structure (Context Items):\n\n${tree}`);
        vscode.window.showInformationMessage('Added context file structure.');
    }

    public async addFolderStructure(folderUri: vscode.Uri) {
        if (!folderUri) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Generating structure for ${path.basename(folderUri.fsPath)}...`,
            cancellable: true
        }, async (_progress, token) => {
             try {
                // Find all files in the folder, respecting gitignore
                const pattern = new vscode.RelativePattern(folderUri, '**/*');
                const exclude = '**/{node_modules,.git,dist,out,build}/**';
                const files = await vscode.workspace.findFiles(pattern, exclude);
                
                if (token.isCancellationRequested) return;

                if (files.length === 0) {
                    vscode.window.showInformationMessage('No files found in folder.');
                    return;
                }

                const filePaths = files.map(f => f.fsPath);
                // We generate the tree from the selected folder URI as root
                const tree = this._generateTree(filePaths, folderUri.fsPath);
                
                this.addNote(`Folder Structure: ${path.basename(folderUri.fsPath)}\n\n${tree}`);
                vscode.window.showInformationMessage('Added folder structure to context.');

             } catch (e) {
                 console.error(e);
                 vscode.window.showErrorMessage('Failed to generate folder structure.');
             }
        });
    }

    private _generateTree(paths: string[], explicitRoot?: string): string {
        const root: any = {};
        
        // Convert to string
        // We need to find the common root to avoid showing full absolute paths if possible,
        // or just show relative to workspace if they are in workspace.
        // For simplicity, let's try to make them relative to the common ancestor.
        
        let commonAncestor = explicitRoot;
        if (!commonAncestor) {
             commonAncestor = this._getCommonAncestor(paths);
        }

        const relativePaths = paths.map(p => path.relative(commonAncestor!, p));
        
        const relativeRoot: any = {};
        for (const p of relativePaths) {
            const parts = p.split(path.sep);
            let current = relativeRoot;
            for (const part of parts) {
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }
        }

        return `Root: ${commonAncestor}\n` + this._renderTree(relativeRoot);
    }

    private _getCommonAncestor(paths: string[]): string {
        if (paths.length === 0) return '';
        if (paths.length === 1) return path.dirname(paths[0]);
        
        const sep = path.sep;
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

    private _renderTree(node: any, prefix: string = ''): string {
        let output = '';
        const keys = Object.keys(node).sort();
        
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const isLast = i === keys.length - 1;
            const children = node[key];
            const hasChildren = Object.keys(children).length > 0;
            
            output += `${prefix}${isLast ? '└── ' : '├── '}${key}\n`;
            
            if (hasChildren) {
                output += this._renderTree(children, prefix + (isLast ? '    ' : '│   '));
            }
        }
        return output;
    }

    public clearAll() {
        this._items = [];
        this._saveState();
        this._updateWebview();
    }

    public getItems(): ContextItem[] {
        return this._items;
    }

    public loadItems(items: ContextItem[]) {
        this._items = items;
        this._saveState();
        this._updateWebview();
    }

    private _updateWebview() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'update-items', items: this._items });
        }
    }

    private _saveState() {
        this._context.workspaceState.update('context-hopper-items', this._items);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Inline HTML/CSS/JS for simplicity in this file
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Context Hopper</title>
            <link href="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'))}" rel="stylesheet" />
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                #list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0;
                }
                .item {
                    padding: 4px 10px;
                    min-height: 22px;
                    display: flex;
                    align-items: flex-start;
                    cursor: pointer;
                    color: var(--vscode-foreground);
                    user-select: none;
                }
                .item:hover {
                    background-color: var(--vscode-list-hoverBackground);
                    color: var(--vscode-list-hoverForeground);
                }
                .item.selected {
                    background-color: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                .item.selected:hover {
                    background-color: var(--vscode-list-activeSelectionBackground);
                }
                .item-icon {
                    margin-right: 6px;
                    display: flex;
                    align-items: center;
                    font-size: 14px;
                    margin-top: 3px; /* Align with text top */
                    flex-shrink: 0;
                }
                .item-content {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 13px;
                    line-height: 22px;
                }
                .item-content.text-mode {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    line-height: normal;
                    font-family: var(--vscode-editor-font-family);
                    padding-top: 2px;
                    max-height: 400px;
                    overflow: auto;
                }
                .item-actions {
                    display: none;
                    margin-left: 10px;
                }
                .item:hover .item-actions {
                    display: flex;
                }
                .icon-btn {
                    cursor: pointer;
                    color: var(--vscode-icon-foreground);
                    background: none;
                    border: none;
                    padding: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 3px;
                }
                .icon-btn:hover {
                    background-color: var(--vscode-toolbar-hoverBackground);
                }
                #footer {
                    padding: 10px;
                    border-top: 1px solid var(--vscode-panel-border);
                    background-color: var(--vscode-sideBar-background);
                }
                #batch-actions {
                    display: none;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 10px;
                    background-color: var(--vscode-editor-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    font-size: 12px;
                }
                .batch-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--vscode-button-foreground);
                    background-color: var(--vscode-button-background);
                    padding: 2px 8px;
                    border-radius: 2px;
                }
                .batch-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .batch-btn.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .batch-btn.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                #footer-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                #token-area {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8em;
                    color: var(--vscode-descriptionForeground);
                }
                #active-indicator {
                    color: var(--vscode-charts-yellow); /* Or textLink-activeForeground */
                }
                #settings-btn {
                    cursor: pointer;
                    padding: 4px;
                }
                #input-area {
                    position: relative;
                    margin-top: 5px;
                }
                #note-input {
                    width: 100%;
                    box-sizing: border-box;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    padding: 8px 30px 8px 8px; /* Right padding for button */
                    resize: none;
                    min-height: 32px;
                    height: 32px; /* Start single line-ish */
                    font-family: inherit;
                    outline: none;
                    overflow: hidden; /* Hide scrollbar */
                }
                #note-input:focus {
                    border-color: var(--vscode-focusBorder);
                }
                #add-btn {
                    position: absolute;
                    right: 6px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: var(--vscode-icon-foreground);
                    cursor: pointer;
                    padding: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                #add-btn:hover {
                    color: var(--vscode-textLink-activeForeground);
                }
            </style>
        </head>
        <body>
            <div id="batch-actions">
                <span id="selection-count">0 selected</span>
                <div style="display: flex; gap: 5px;">
                    <button id="batch-copy-btn" class="batch-btn secondary" title="Copy Selected">Copy</button>
                    <button id="batch-delete-btn" class="batch-btn" title="Delete Selected">Delete</button>
                </div>
            </div>
            <div id="list"></div>
            <div id="footer">
                <div id="footer-content">
                    <div id="token-area">
                        <span id="token-display">Total Tokens: 0</span>
                        <span id="active-indicator" class="codicon codicon-zap" title="Optimizations Active" style="display: none;"></span>
                    </div>
                    <div id="settings-area">
                        <div id="settings-btn" class="icon-btn" title="Output Settings">
                            <span class="codicon codicon-gear"></span>
                        </div>
                    </div>
                </div>
                <div id="input-area">
                    <textarea id="note-input" placeholder="Add context..."></textarea>
                    <button id="add-btn" title="Add Note">
                        <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M1.5 8a.5.5 0 0 1 .5-.5h10.793L9.146 3.854a.5.5 0 1 1 .708-.708l4.5 4.5a.5.5 0 0 1 0 .708l-4.5 4.5a.5.5 0 0 1-.708-.708L12.793 8.5H2a.5.5 0 0 1-.5-.5z"/></svg>
                    </button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const list = document.getElementById('list');
                const tokenDisplay = document.getElementById('token-display');
                const activeIndicator = document.getElementById('active-indicator');
                const noteInput = document.getElementById('note-input');
                const addBtn = document.getElementById('add-btn');
                const settingsBtn = document.getElementById('settings-btn');
                const batchActions = document.getElementById('batch-actions');
                const selectionCount = document.getElementById('selection-count');
                const batchCopyBtn = document.getElementById('batch-copy-btn');
                const batchDeleteBtn = document.getElementById('batch-delete-btn');

                let selectedIds = new Set();
                let lastSelectedId = null;

                // Settings Handlers
                settingsBtn.addEventListener('click', () => {
                    vscode.postMessage({ type: 'open-optimization-menu' });
                });

                let items = [];
                let optimizationSettings = { removeComments: false, removeEmptyLines: false };

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'update-items':
                            items = message.items;
                            // Clean up selectedIds if items were removed
                            const currentIds = new Set(items.map(i => i.id));
                            selectedIds = new Set([...selectedIds].filter(id => currentIds.has(id)));
                            updateBatchActions();
                            render();
                            break;
                        case 'update-optimization-settings':
                            optimizationSettings = message.settings;
                            updateFooter();
                            render(); // Re-render to update tokens if needed (though tokens are usually pre-calc)
                            break;
                    }
                });

                function updateFooter() {
                    const isActive = optimizationSettings.removeComments || optimizationSettings.removeEmptyLines;
                    activeIndicator.style.display = isActive ? 'block' : 'none';
                }

                // Auto-resize textarea
                noteInput.addEventListener('input', function() {
                    this.style.height = '32px';
                    this.style.height = (this.scrollHeight) + 'px';
                });

                // Add Note
                addBtn.addEventListener('click', () => {
                    const text = noteInput.value.trim();
                    if (text) {
                        vscode.postMessage({ type: 'add-note', text: text });
                        noteInput.value = '';
                        noteInput.style.height = '32px';
                    }
                });
                noteInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        addBtn.click();
                    }
                });

                // Batch Actions
                function updateBatchActions() {
                    if (selectedIds.size > 0) {
                        batchActions.style.display = 'flex';
                        selectionCount.textContent = \`\${selectedIds.size} selected\`;
                    } else {
                        batchActions.style.display = 'none';
                    }
                }

                batchCopyBtn.addEventListener('click', () => {
                    vscode.postMessage({ type: 'copy-items', ids: Array.from(selectedIds) });
                    selectedIds.clear();
                    updateBatchActions();
                    render();
                });

                batchDeleteBtn.addEventListener('click', () => {
                    vscode.postMessage({ type: 'delete-items', ids: Array.from(selectedIds) });
                    // Optimistic update
                    // items = items.filter(i => !selectedIds.has(i.id));
                    // selectedIds.clear();
                    // updateBatchActions();
                    // render();
                    // Actually, let's wait for update-items from extension to be safe
                });

                // Render List
                function render() {
                    list.innerHTML = '';
                    let totalTokens = 0;

                    items.forEach(item => {
                        const el = document.createElement('div');
                        el.className = 'item';
                        if (selectedIds.has(item.id)) {
                            el.classList.add('selected');
                        }
                        el.dataset.id = item.id;

                        // Click Handler for Selection
                        el.onclick = (e) => {
                            if (e.ctrlKey || e.metaKey) {
                                // Toggle
                                if (selectedIds.has(item.id)) {
                                    selectedIds.delete(item.id);
                                } else {
                                    selectedIds.add(item.id);
                                    lastSelectedId = item.id;
                                }
                            } else if (e.shiftKey && lastSelectedId) {
                                // Range
                                const lastIdx = items.findIndex(i => i.id === lastSelectedId);
                                const currIdx = items.findIndex(i => i.id === item.id);
                                const start = Math.min(lastIdx, currIdx);
                                const end = Math.max(lastIdx, currIdx);
                                for (let i = start; i <= end; i++) {
                                    selectedIds.add(items[i].id);
                                }
                            } else {
                                // Single Select (unless clicking action)
                                selectedIds.clear();
                                selectedIds.add(item.id);
                                lastSelectedId = item.id;
                            }
                            updateBatchActions();
                            render();
                        };

                        // Icon (Restored)
                        const icon = document.createElement('div');
                        icon.className = 'item-icon';
                        if (item.type === 'file') {
                            icon.innerHTML = \`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M13.71 4.29l-3-3L10 1H4L3 2v12l1 1h9l1-1V5l-.29-.71zM13 14H4V2h5v4h4v8z"/></svg>\`;
                        } else {
                            icon.innerHTML = \`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M2.5 1h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11A1.5 1.5 0 0 1 2.5 1zm11 1.5h-11v11h11v-11zM4 4h8v1H4V4zm0 3h8v1H4V7zm0 3h5v1H4v-1z"/></svg>\`;
                        }
                        el.appendChild(icon);

                        // Content
                        const content = document.createElement('div');
                        content.className = 'item-content';
                        if (item.type === 'file') {
                            content.textContent = item.label || item.content;
                            if (item.range) {
                                content.textContent += \` :\${item.range.start + 1}-\${item.range.end + 1}\`;
                            }
                            content.title = item.content;
                            el.ondblclick = () => {
                                vscode.postMessage({ type: 'open-file', path: item.content, range: item.range });
                            };
                        } else {
                            content.textContent = item.content;
                            content.title = item.content;
                            content.classList.add('text-mode');
                        }
                        el.appendChild(content);
                        
                        // Actions
                        const actions = document.createElement('div');
                        actions.className = 'item-actions';
                        const delBtn = document.createElement('button');
                        delBtn.className = 'icon-btn';
                        // Cross icon (VS Code style 'close')
                        delBtn.innerHTML = \`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M8 7.293l4.146-4.147.708.708L8.707 8l4.147 4.146-.708.708L8 8.707l-4.146 4.147-.708-.708L7.293 8 3.146 3.854l.708-.708L8 7.293z"/></svg>\`;
                        delBtn.title = 'Remove Item';
                        delBtn.onclick = (e) => {
                            e.stopPropagation();
                            vscode.postMessage({ type: 'delete-item', id: item.id });
                        };
                        actions.appendChild(delBtn);
                        el.appendChild(actions);

                        list.appendChild(el);

                        if (item.tokens) {
                            totalTokens += item.tokens;
                        } else {
                            // Fallback estimate
                            totalTokens += Math.ceil(item.content.length / 4);
                        }
                    });

                    tokenDisplay.textContent = \`Total Tokens: \${totalTokens}\`;
                }
            </script>
        </body>
        </html>`;
    }
}
