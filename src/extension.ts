import * as vscode from 'vscode';
import * as path from 'path';
import { encodingForModel } from 'js-tiktoken';
import { ContextWebviewProvider, ContextItem } from './contextWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "context-hopper" is now active!');

    // Initialize tokenizer
    const enc = encodingForModel('gpt-4');

	const contextWebviewProvider = new ContextWebviewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ContextWebviewProvider.viewType, contextWebviewProvider)
	);

	let disposable = vscode.commands.registerCommand('context-hopper.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Context Hopper!');
	});

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
            let tokens = 0;
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                let text = '';
                if (range) {
                    text = doc.getText(range);
                } else {
                    text = doc.getText();
                }
                // Accurate token count using js-tiktoken
                tokens = enc.encode(text).length;
            } catch (e) {
                console.error('Error reading file for token calculation:', e);
            }

            const item: ContextItem = {
                id: Date.now().toString(),
                type: 'file',
                content: uri.fsPath,
                label: path.basename(uri.fsPath),
                range: range ? { start: range.start.line, end: range.end.line } : undefined,
                tokens: tokens
            };
            contextWebviewProvider.addItem(item);
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

            for (const change of changes) {
                if (change.status === 6) { // Deleted
                    continue;
                }
                
                const uri = change.uri;
                let tokens = 0;
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    const text = doc.getText();
                    tokens = enc.encode(text).length;
                } catch (e) {
                    console.log('Skipping deleted or inaccessible file:', uri.fsPath);
                    continue;
                }

                const item: ContextItem = {
                    id: Date.now().toString() + Math.random().toString(), // Ensure unique ID
                    type: 'file',
                    content: uri.fsPath,
                    label: path.basename(uri.fsPath),
                    tokens: tokens
                };
                contextWebviewProvider.addItem(item);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            vscode.window.showInformationMessage(`Added ${addedCount} changed files to context.`);
        } else {
            vscode.window.showInformationMessage('No Git changes found.');
        }
    });

	context.subscriptions.push(disposable);
    context.subscriptions.push(addItemDisposable);
    context.subscriptions.push(copyAllDisposable);
    context.subscriptions.push(clearDisposable);
    context.subscriptions.push(addGitChangesDisposable);
}

export function deactivate() {}
