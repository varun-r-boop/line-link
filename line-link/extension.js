const vscode = require('vscode');
const path = require('path');
const { simpleGit } = require('simple-git');

// Function to get repository information
async function getRepositoryInfo(filePath) {
    try {
        // Get the directory containing the file
        const directory = path.dirname(filePath);
        const git = simpleGit(directory);
        const isRepo = await git.checkIsRepo();
        
        if (isRepo) {
            // Get the remote URL
            const remotes = await git.getRemotes(true);
            const origin = remotes.find(r => r.name === 'origin');
            if (origin) {
                // Get the relative path from repository root
                const repoRoot = await git.revparse(['--show-toplevel']);
                const relativePath = path.relative(repoRoot, filePath);
                return {
                    type: 'git',
                    identifier: origin.refs.push,
                    relativePath: relativePath.replace(/\\/g, '/') // Normalize path separators
                };
            }
        }
        
        // Fallback for non-Git repositories
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const relativePath = path.relative(workspaceRoot, filePath);
            return {
                type: 'workspace',
                identifier: workspaceFolders[0].name,
                relativePath: relativePath.replace(/\\/g, '/')
            };
        }
        
        throw new Error('Could not determine repository information');
    } catch (error) {
        console.error('Error getting repository info:', error);
        throw error;
    }
}

function activate(context) {
    // Register the command to generate the link
    const generateLinkCommand = vscode.commands.registerCommand('extension.generateLink', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            try {
                const document = editor.document;
                const selection = editor.selection;
                const line = selection.active.line + 1; // VS Code lines are 0-based
                const filePath = document.uri.fsPath;

                // Get repository information
                const repoInfo = await getRepositoryInfo(filePath);
                
                // Generate the link
                const link = `vscode://file/${filePath}:${line}`;
                
                // Copy to clipboard
                await vscode.env.clipboard.writeText(link);
                vscode.window.showInformationMessage(`Link copied to clipboard: ${link}`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate link: ${error.message}`);
            }
        }
    });

    // Register the command to open the file at a specific line
    const openFileCommand = vscode.commands.registerCommand('extension.openFile', async () => {
        try {
            // Prompt user for the link
            const link = await vscode.window.showInputBox({
                prompt: 'Paste the line link',
                placeHolder: 'vscode://file/...'
            });

            if (!link) {
                return;
            }

            // Parse the link
            const uri = vscode.Uri.parse(link);
            const line = parseInt(uri.fragment, 10) - 1; // VS Code lines are 0-based

            // Open the file
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);

            // Navigate to the line
            const range = editor.document.lineAt(line).range;
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
        }
    });

    // Register the commands in the context
    context.subscriptions.push(generateLinkCommand);
    context.subscriptions.push(openFileCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
