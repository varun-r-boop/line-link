import * as vscode from 'vscode';
import * as path from 'path';
import { simpleGit } from 'simple-git';

// Types
interface RepositoryInfo {
    type: 'git' | 'workspace';
    identifier: string;
    relativePath: string;
}

interface LinkInfo {
    filePath: string;
    line: number;
}

// Constants
const PROTOCOL_PREFIX = 'vscode://file/';
const ERROR_MESSAGES = {
    NO_ACTIVE_EDITOR: 'No active editor found',
    GENERATE_LINK_FAILED: 'Failed to generate link',
    OPEN_FILE_FAILED: 'Failed to open file',
    INVALID_LINK: 'Invalid link format',
    NO_REPO_INFO: 'Could not determine repository information'
} as const;

// Utility functions
function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

function validateLink(link: string): boolean {
    return link.startsWith(PROTOCOL_PREFIX);
}

// Repository handling
async function getRepositoryInfo(filePath: string): Promise<RepositoryInfo> {
    try {
        const directory = path.dirname(filePath);
        const git = simpleGit(directory);
        const isRepo = await git.checkIsRepo();
        
        if (isRepo) {
            const remotes = await git.getRemotes(true);
            const origin = remotes.find(r => r.name === 'origin');
            if (origin) {
                const repoRoot = await git.revparse(['--show-toplevel']);
                const relativePath = path.relative(repoRoot, filePath);
                return {
                    type: 'git',
                    identifier: origin.refs.push,
                    relativePath: normalizePath(relativePath)
                };
            }
        }
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const relativePath = path.relative(workspaceRoot, filePath);
            return {
                type: 'workspace',
                identifier: workspaceFolders[0].name,
                relativePath: normalizePath(relativePath)
            };
        }
        
        throw new Error(ERROR_MESSAGES.NO_REPO_INFO);
    } catch (error) {
        console.error('Error getting repository info:', error);
        throw error instanceof Error ? error : new Error(String(error));
    }
}

// Link generation
async function generateLink(editor: vscode.TextEditor): Promise<string> {
    const document = editor.document;
    const selection = editor.selection;
    const line = selection.active.line + 1;
    const filePath = document.uri.fsPath;
    
    await getRepositoryInfo(filePath); // Validate repository info
    return `${PROTOCOL_PREFIX}${filePath}:${line}`;
}

// File opening
async function openFileAtLine(link: string): Promise<void> {
    if (!validateLink(link)) {
        throw new Error(ERROR_MESSAGES.INVALID_LINK);
    }

    const uri = vscode.Uri.parse(link);
    const line = parseInt(uri.fragment, 10) - 1;

    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    const range = editor.document.lineAt(line).range;
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}

// Command handlers
async function handleGenerateLink(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        throw new Error(ERROR_MESSAGES.NO_ACTIVE_EDITOR);
    }

    try {
        const link = await generateLink(editor);
        await vscode.env.clipboard.writeText(link);
        vscode.window.showInformationMessage(`Link copied to clipboard: ${link}`);
    } catch (error) {
        vscode.window.showErrorMessage(`${ERROR_MESSAGES.GENERATE_LINK_FAILED}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function handleOpenFile(): Promise<void> {
    try {
        const link = await vscode.window.showInputBox({
            prompt: 'Paste the line link',
            placeHolder: 'vscode://file/...'
        });

        if (!link) {
            return;
        }

        await openFileAtLine(link);
    } catch (error) {
        vscode.window.showErrorMessage(`${ERROR_MESSAGES.OPEN_FILE_FAILED}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Extension activation
export function activate(context: vscode.ExtensionContext): void {
    const generateLinkCommand = vscode.commands.registerCommand('extension.generateLink', handleGenerateLink);
    const openFileCommand = vscode.commands.registerCommand('extension.openFile', handleOpenFile);

    context.subscriptions.push(generateLinkCommand, openFileCommand);
}

export function deactivate(): void {} 