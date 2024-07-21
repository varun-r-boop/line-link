const vscode = require('vscode');
const path = require('path');

function activate(context) {
    // Register the command to generate the link
    const generateLinkCommand = vscode.commands.registerCommand('extension.generateLink', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const selection = editor.selection;
            const line = selection.active.line + 1; // VS Code lines are 0-based
            const filePath = document.uri.fsPath;

            // Get the base path from the configuration
            const config = vscode.workspace.getConfiguration('lineLinker');
            const basePath = config.get('repoBasePath');

            if (!basePath) {
                vscode.window.showErrorMessage('Please configure the repository base path in settings.');
                return;
            }

            // Ensure the base path and file path are properly formatted
            const fileUri = vscode.Uri.file(filePath).toString();
            const link = `vscode://file/${fileUri.replace(/^[^:]+:/, '')}&line=${line}`; // Remove 'file:' prefix
            vscode.env.clipboard.writeText(link);
            vscode.window.showInformationMessage(`Link copied to clipboard: ${link}`);
        }
    });

    // Register the command to open the file at a specific line
    const openFileCommand = vscode.commands.registerCommand('extension.openFile', async (uri) => {
        const query = new URLSearchParams(uri.query);
        const relativePath = uri.path.slice(1); // Remove leading slash
        const line = parseInt(query.get('line'), 10) - 1; // VS Code lines are 0-based

        // Get the base path from the configuration
        const config = vscode.workspace.getConfiguration('lineLinker');
        const basePath = config.get('repoBasePath');

        if (!basePath) {
            vscode.window.showErrorMessage('Please configure the repository base path in settings.');
            return;
        }

        const filePath = path.join(basePath, relativePath);

        if (filePath) {
            const document = await vscode.workspace.openTextDocument(filePath);
            const editor = await vscode.window.showTextDocument(document);

            const range = editor.document.lineAt(line).range;
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        }
    });

    // Register the commands in the context
    context.subscriptions.push(generateLinkCommand);
    context.subscriptions.push(openFileCommand);

    // Register the URI handler
    context.subscriptions.push(vscode.window.registerUriHandler({
        handleUri(uri) {
            vscode.commands.executeCommand('extension.openFile', uri);
        }
    }));
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
