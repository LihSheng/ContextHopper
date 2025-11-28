import * as vscode from 'vscode';
import { ContextItem } from './contextWebviewProvider';

export interface SavedGroup {
    id: string;
    name: string;
    items: ContextItem[];
    pinned: boolean;
    totalTokens: number;
    createdAt: number;
}

export class SavedContextTreeProvider implements vscode.TreeDataProvider<SavedGroup | ContextItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SavedGroup | ContextItem | undefined | null | void> = new vscode.EventEmitter<SavedGroup | ContextItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SavedGroup | ContextItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SavedGroup | ContextItem): vscode.TreeItem {
        if ('items' in element) {
            // It's a Group
            const treeItem = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Collapsed);
            treeItem.contextValue = 'savedGroup';
            treeItem.description = `~${element.totalTokens} tokens`;
            treeItem.tooltip = `${element.items.length} items`;
            
            // Icons
            if (element.pinned) {
                treeItem.iconPath = new vscode.ThemeIcon('pinned');
                treeItem.contextValue = 'savedGroupPinned';
            } else {
                treeItem.iconPath = new vscode.ThemeIcon('repo');
                treeItem.contextValue = 'savedGroup';
            }
            
            return treeItem;
        } else {
            // It's an Item inside a group
            const treeItem = new vscode.TreeItem(element.label || element.content);
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.description = element.type === 'file' ? element.content : 'Note';
            treeItem.iconPath = element.type === 'file' ? vscode.ThemeIcon.File : new vscode.ThemeIcon('note');
            treeItem.tooltip = element.content;
            return treeItem;
        }
    }

    getChildren(element?: SavedGroup | ContextItem): vscode.ProviderResult<(SavedGroup | ContextItem)[]> {
        if (!element) {
            // Root: Return Groups
            const groups = this.getGroups();
            // Sort: Pinned first, then Alphabetical
            return groups.sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return a.name.localeCompare(b.name);
            });
        } else if ('items' in element) {
            // Group: Return Items
            return element.items;
        } else {
            // Item: No children
            return [];
        }
    }

    private getGroups(): SavedGroup[] {
        return this.context.workspaceState.get<SavedGroup[]>('savedContextGroups', []);
    }

    private async updateGroups(groups: SavedGroup[]) {
        await this.context.workspaceState.update('savedContextGroups', groups);
        this.refresh();
    }

    public async saveGroup(name: string, items: ContextItem[]) {
        const groups = this.getGroups();
        const totalTokens = items.reduce((sum, item) => sum + (item.tokens || 0), 0);
        
        const newGroup: SavedGroup = {
            id: Date.now().toString(),
            name,
            items,
            pinned: false,
            totalTokens,
            createdAt: Date.now()
        };

        groups.push(newGroup);
        await this.updateGroups(groups);
    }

    public async deleteGroup(group: SavedGroup) {
        const groups = this.getGroups().filter(g => g.id !== group.id);
        await this.updateGroups(groups);
    }

    public async togglePin(group: SavedGroup) {
        const groups = this.getGroups();
        const target = groups.find(g => g.id === group.id);
        if (target) {
            target.pinned = !target.pinned;
            await this.updateGroups(groups);
        }
    }

    public getGroup(group: SavedGroup): SavedGroup | undefined {
        return this.getGroups().find(g => g.id === group.id);
    }
}
