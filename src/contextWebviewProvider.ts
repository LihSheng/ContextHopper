import * as vscode from 'vscode';
import * as path from 'path';

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
            tokens: Math.ceil(text.length / 4)
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

    private async copyAll() {
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

    private clearAll() {
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
                    padding: 10px;
                }
                .item {
                    background-color: var(--vscode-list-hoverBackground);
                    margin-bottom: 5px;
                    padding: 8px;
                    border-radius: 4px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: grab;
                    user-select: none;
                }
                .item:active {
                    cursor: grabbing;
                }
                .item-content {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    cursor: pointer;
                }
                .item-actions {
                    display: flex;
                    gap: 5px;
                }
                .icon-btn {
                    cursor: pointer;
                    color: var(--vscode-icon-foreground);
                    background: none;
                    border: none;
                    padding: 2px;
                }
                .icon-btn:hover {
                    color: var(--vscode-list-highlightForeground);
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
                    display: flex;
                    gap: 5px;
                }
                #note-input {
                    flex: 1;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 4px;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 4px 8px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .dragging {
                    opacity: 0.5;
                }
            </style>
        </head>
        <body>
            <div id="list"></div>
            <div id="footer">
                <div id="token-display">Total Tokens: 0</div>
                <div id="input-area">
                    <input type="text" id="note-input" placeholder="Add a note..." />
                    <button id="add-btn">Add</button>
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

                // Add Note
                addBtn.addEventListener('click', () => {
                    const text = noteInput.value.trim();
                    if (text) {
                        vscode.postMessage({ type: 'add-note', text: text });
                        noteInput.value = '';
                    }
                });
                noteInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
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
                        el.draggable = true;
                        el.dataset.id = item.id;

                        const content = document.createElement('div');
                        content.className = 'item-content';
                        if (item.type === 'file') {
                            content.textContent = item.label || item.content;
                            if (item.range) {
                                content.textContent += \` :\${item.range.start + 1}-\${item.range.end + 1}\`;
                            }
                            content.title = item.content;
                            content.onclick = () => {
                                vscode.postMessage({ type: 'open-file', path: item.content, range: item.range });
                            };
                        } else {
                            content.textContent = item.content;
                            content.title = item.content;
                        }
                        
                        const actions = document.createElement('div');
                        actions.className = 'item-actions';
                        const delBtn = document.createElement('button');
                        delBtn.className = 'icon-btn';
                        delBtn.innerHTML = '🗑️';
                        delBtn.onclick = (e) => {
                            e.stopPropagation();
                            vscode.postMessage({ type: 'delete-item', id: item.id });
                        };
                        actions.appendChild(delBtn);

                        el.appendChild(content);
                        el.appendChild(actions);

                        // Drag Events
                        el.addEventListener('dragstart', () => {
                            el.classList.add('dragging');
                        });
                        el.addEventListener('dragend', () => {
                            el.classList.remove('dragging');
                            updateOrder();
                        });

                        list.appendChild(el);

                        // Token Calc (Simple heuristic)
                        // In a real app, extension should calculate and send tokens.
                        // For now, let's assume extension sends it or we estimate.
                        // The extension code I wrote sends 'tokens' property for notes, but maybe not files yet.
                        // Let's rely on extension sending it in future updates, or estimate here.
                        if (item.tokens) {
                            totalTokens += item.tokens;
                        } else {
                            // Fallback estimate
                            totalTokens += Math.ceil(item.content.length / 4);
                        }
                    });

                    tokenDisplay.textContent = \`Total Tokens: \${totalTokens}\`;
                }

                // Drag Over Logic
                list.addEventListener('dragover', e => {
                    e.preventDefault();
                    const afterElement = getDragAfterElement(list, e.clientY);
                    const draggable = document.querySelector('.dragging');
                    if (afterElement == null) {
                        list.appendChild(draggable);
                    } else {
                        list.insertBefore(draggable, afterElement);
                    }
                });

                function getDragAfterElement(container, y) {
                    const draggableElements = [...container.querySelectorAll('.item:not(.dragging)')];

                    return draggableElements.reduce((closest, child) => {
                        const box = child.getBoundingClientRect();
                        const offset = y - box.top - box.height / 2;
                        if (offset < 0 && offset > closest.offset) {
                            return { offset: offset, element: child };
                        } else {
                            return closest;
                        }
                    }, { offset: Number.NEGATIVE_INFINITY }).element;
                }

                function updateOrder() {
                    const newOrderIds = [...list.querySelectorAll('.item')].map(el => el.dataset.id);
                    vscode.postMessage({ type: 'reorder-items', items: newOrderIds });
                }
            </script>
        </body>
        </html>`;
    }
}
