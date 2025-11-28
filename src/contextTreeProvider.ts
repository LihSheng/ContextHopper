import * as vscode from 'vscode';
import * as path from 'path';

export class ContextItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri?: vscode.Uri,
        public readonly range?: vscode.Range,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = this.label;
        this.description = this.resourceUri ? path.basename(this.resourceUri.fsPath) : '';
        
        if (this.range) {
            this.description += ` :${this.range.start.line + 1}-${this.range.end.line + 1}`;
        }
    }
}

export class ContextTreeProvider implements vscode.TreeDataProvider<ContextItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ContextItem | undefined | null | void> = new vscode.EventEmitter<ContextItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ContextItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private items: ContextItem[] = [];

    constructor() {
        this.items = [];
    }

    getTreeItem(element: ContextItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ContextItem): Thenable<ContextItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.items);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    addItem(item: ContextItem): void {
        this.items.push(item);
        this.refresh();
    }

    removeItem(item: ContextItem): void {
        this.items = this.items.filter(i => i !== item);
        this.refresh();
    }

    clear(): void {
        this.items = [];
        this.refresh();
    }

    getItems(): ContextItem[] {
        return this.items;
    }
}
