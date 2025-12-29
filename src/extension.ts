import * as vscode from 'vscode';
import * as path from 'path';

import { ContextWebviewProvider, ContextItem } from './contextWebviewProvider';
import { SavedContextTreeProvider, SavedGroup } from './savedContextTreeProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "context-hopper" is now active!');



	const contextWebviewProvider = new ContextWebviewProvider(context.extensionUri, context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ContextWebviewProvider.viewType, contextWebviewProvider)
	);

	let disposable = vscode.commands.registerCommand('context-hopper.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Context Hopper!');
	});

    // Helper to add a single file
    const addFileToContext = async (uri: vscode.Uri, range?: vscode.Range) => {

        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            let text = '';
            if (range) {
                text = doc.getText(range);
            } else {
                text = doc.getText();
            }


            const item: ContextItem = {
                id: Date.now().toString() + Math.random().toString().slice(2), // Unique ID
                type: 'file',
                content: uri.fsPath,
                label: path.basename(uri.fsPath),
                languageId: doc.languageId,
                range: range ? { start: range.start.line, end: range.end.line } : undefined
            };
            contextWebviewProvider.addItem(item);
        } catch (e) {
            console.error('Error reading file for token calculation:', e);
        }
    };

    let addItemDisposable = vscode.commands.registerCommand('context-hopper.addItem', async (uri: vscode.Uri) => {
        let range: vscode.Range | undefined;

        if (!uri) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                uri = editor.document.uri;
                if (!editor.selection.isEmpty) {
                    range = editor.selection;
                }
            }
        } else {
            // If uri is passed (e.g. from explorer), check if it matches active editor to get selection
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.uri.toString() === uri.toString() && !editor.selection.isEmpty) {
                range = editor.selection;
            }
        }

        if (uri) {
            try {
                const stat = await vscode.workspace.fs.stat(uri);
                if (stat.type === vscode.FileType.Directory) {
                    // It's a folder, add all files recursively
                    const pattern = new vscode.RelativePattern(uri, '**/*');
                    // Exclude node_modules and .git
                    const exclude = '**/{node_modules,.git}/**';
                    const files = await vscode.workspace.findFiles(pattern, exclude);

                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `Adding ${files.length} files from ${path.basename(uri.fsPath)}...`,
                        cancellable: true
                    }, async (progress, token) => {
                        let count = 0;
                        for (const file of files) {
                            if (token.isCancellationRequested) break;
                            await addFileToContext(file);
                            count++;
                            progress.report({ increment: (1 / files.length) * 100, message: `${count}/${files.length}` });
                        }
                    });
                } else {
                    // It's a file
                    await addFileToContext(uri, range);
                }
            } catch (e) {
                console.error('Error adding item:', e);
                vscode.window.showErrorMessage('Failed to add item to context.');
            }
        }
    });

    let copyAllDisposable = vscode.commands.registerCommand('context-hopper.copyAll', () => {
        contextWebviewProvider.copyAll();
    });

    let clearDisposable = vscode.commands.registerCommand('context-hopper.clear', () => {
        contextWebviewProvider.clearAll();
    });

    let addGitChangesDisposable = vscode.commands.registerCommand('context-hopper.addGitChanges', async () => {
        const gitExtension = vscode.extensions.getExtension<any>('vscode.git')?.exports;
        if (!gitExtension) {
            vscode.window.showErrorMessage('Git extension not found.');
            return;
        }
        const git = gitExtension.getAPI(1);
        const repositories = git.repositories;

        if (repositories.length === 0) {
            vscode.window.showInformationMessage('No Git repositories found.');
            return;
        }

        let addedCount = 0;

        for (const repo of repositories) {
            const changes = [
                ...repo.state.workingTreeChanges,
                ...repo.state.indexChanges,
                ...repo.state.mergeChanges
            ];

            vscode.window.showInformationMessage('No Git changes found.');
        }
    });

	context.subscriptions.push(disposable);
    context.subscriptions.push(addItemDisposable);
    context.subscriptions.push(copyAllDisposable);
    context.subscriptions.push(clearDisposable);
    context.subscriptions.push(addGitChangesDisposable);
    context.subscriptions.push(vscode.commands.registerCommand('context-hopper.addFileStructure', () => {
        contextWebviewProvider.addFileStructure();
    }));

	context.subscriptions.push(
		vscode.commands.registerCommand('context-hopper.refresh', () => {
			contextWebviewProvider.refresh();
		})
	);

    context.subscriptions.push(vscode.commands.registerCommand('context-hopper.addFolderStructure', (uri: vscode.Uri) => {
        contextWebviewProvider.addFolderStructure(uri);
    }));

    // Saved Contexts
    const savedContextTreeProvider = new SavedContextTreeProvider(context);
    vscode.window.registerTreeDataProvider('context-hopper-saved', savedContextTreeProvider);

    context.subscriptions.push(vscode.commands.registerCommand('context-hopper.saveContext', async () => {
        const items = contextWebviewProvider.getItems();
        if (items.length === 0) {
            vscode.window.showInformationMessage('Context list is empty.');
            return;
        }
        const name = await vscode.window.showInputBox({ prompt: 'Enter a name for this context group' });
        if (name) {
            await savedContextTreeProvider.saveGroup(name, items);
            vscode.window.showInformationMessage(`Saved group "${name}".`);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('context-hopper.loadGroup', (group: SavedGroup) => {
        contextWebviewProvider.loadItems(group.items);
        vscode.window.showInformationMessage(`Loaded group "${group.name}".`);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('context-hopper.deleteGroup', async (group: SavedGroup) => {
        const confirm = await vscode.window.showWarningMessage(`Delete group "${group.name}"?`, 'Yes', 'No');
        if (confirm === 'Yes') {
            await savedContextTreeProvider.deleteGroup(group);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('context-hopper.pinGroup', async (group: SavedGroup) => {
        await savedContextTreeProvider.togglePin(group);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('context-hopper.unpinGroup', async (group: SavedGroup) => {
        await savedContextTreeProvider.togglePin(group);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('context-hopper.copyGroup', async (group: SavedGroup) => {
        // Re-use logic from WebviewProvider? Or duplicate? 
        // Duplicating slightly modified logic to avoid tight coupling or complex passing
        // Ideally we refactor 'copy logic' to a shared util, but for now:
        
        let content = '';
        const config = vscode.workspace.getConfiguration('contextHopper');
        const redactSecrets = config.get<boolean>('redactSecrets', true);

        for (const item of group.items) {
             if (item.type === 'file') {
                try {
                    const uri = vscode.Uri.file(item.content);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    content += `\n// File: ${path.basename(item.content)}\n`;
                    content += `// Path: ${item.content}\n`;
                    if (item.range) {
                        content += `// Lines: ${item.range.start + 1}-${item.range.end + 1}\n`;
                        const range = new vscode.Range(item.range.start, 0, item.range.end, 1000); 
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

        let redactedMsg = '';
        if (redactSecrets) {
             // Need to import scrubSecrets here too or move to util
             // Assuming scrubSecrets is exported from util
             const { scrubSecrets } = require('./utils/secretScrubber');
             const result = scrubSecrets(content);
             content = result.cleanText;
             if (result.redactedCount > 0) {
                 redactedMsg = ` (Redacted ${result.redactedCount} secrets)`;
             }
        }

        await vscode.env.clipboard.writeText(content);
        vscode.window.showInformationMessage(`Copied group "${group.name}" to clipboard.${redactedMsg}`);
    }));

    // Handle Webview Messages (Optimization Menu)
    // We need to expose a method in ContextWebviewProvider to trigger this or handle it via command
    // Since message comes from webview, it's handled in provider. But provider needs to call VS Code UI.
    // Let's add a command that the provider calls, or handle it inside provider.
    // Provider has access to vscode.window.showQuickPick.
    // Wait, ContextWebviewProvider is in a separate file. It can import vscode.
    // So we can handle showQuickPick directly in ContextWebviewProvider.ts!
    // I will update ContextWebviewProvider.ts instead of extension.ts for this logic to keep it encapsulated.
}

export function deactivate() {}
