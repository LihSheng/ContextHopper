import * as vscode from 'vscode';
import * as path from 'path';
import { encodingForModel } from 'js-tiktoken';

export interface ContextItem {
    id: string;
    type: 'file' | 'text';
    content: string; // File path or text content
    label?: string;
    range?: { start: number; end: number }; // Line numbers (0-indexed)
    tokens?: number;
}

export class ContextWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'context-hopper-view';

    private _view?: vscode.WebviewView;
    private _items: ContextItem[] = [];
    private _enc = encodingForModel('gpt-4');

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

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

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'delete-item':
                    this.removeItem(data.id);
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
                case 'clear-all':
                    this.clearAll();
                    break;
            }
        });
    }

    public addItem(item: ContextItem) {
        // Check for duplicates if it's a file
        if (item.type === 'file') {
            const existing = this._items.find(i => i.type === 'file' && i.content === item.content && JSON.stringify(i.range) === JSON.stringify(item.range));
            if (existing) {
                return;
            }
        }
        this._items.push(item);
        this._updateWebview();
    }

    private removeItem(id: string) {
        this._items = this._items.filter(x => x.id !== id);
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
        this._updateWebview();
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
                    content += `\n// File: ${path.basename(item.content)}\n`;
                    content += `// Path: ${item.content}\n`;
                    if (item.range) {
                        content += `// Lines: ${item.range.start + 1}-${item.range.end + 1}\n`;
                        const range = new vscode.Range(item.range.start, 0, item.range.end, 1000); // Approximate end char
                        content += doc.getText(range) + '\n';
                    } else {
                        content += doc.getText() + '\n';
                    }
                } catch (e) {
                    content += `\n// Error reading file: ${item.content}\n`;
                }
            } else if (item.type === 'text') {
                content += `\n// Note:\n${item.content}\n`;
            }
        }
        await vscode.env.clipboard.writeText(content);
        vscode.window.showInformationMessage(`Copied ${this._items.length} items to clipboard.`);
    }

    public clearAll() {
        this._items = [];
        this._updateWebview();
    }

    private _updateWebview() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'update-items', items: this._items });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Inline HTML/CSS/JS for simplicity in this file
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Context Hopper</title>
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
                    padding: 0 10px;
                    height: 22px;
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    color: var(--vscode-foreground);
                    user-select: none;
                }
                .item:hover {
                    background-color: var(--vscode-list-hoverBackground);
                    color: var(--vscode-list-hoverForeground);
                }
                .item-icon {
                    margin-right: 6px;
                    display: flex;
                    align-items: center;
                    font-size: 14px;
                }
                .item-content {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 13px;
                    line-height: 22px;
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
                #token-display {
                    font-size: 0.8em;
                    margin-bottom: 8px;
                    color: var(--vscode-descriptionForeground);
                    text-align: right;
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
            <div id="list"></div>
            <div id="footer">
                <div id="token-display">Total Tokens: 0</div>
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
                const noteInput = document.getElementById('note-input');
                const addBtn = document.getElementById('add-btn');

                let items = [];

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'update-items':
                            items = message.items;
                            render();
                            break;
                    }
                });

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

                // Render List
                function render() {
                    list.innerHTML = '';
                    let totalTokens = 0;

                    items.forEach(item => {
                        const el = document.createElement('div');
                        el.className = 'item';
                        el.dataset.id = item.id;

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
                            el.onclick = () => {
                                vscode.postMessage({ type: 'open-file', path: item.content, range: item.range });
                            };
                        } else {
                            content.textContent = item.content;
                            content.title = item.content;
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
