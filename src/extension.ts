import * as vscode from 'vscode';

/**
 * URI scheme used for our chat sessions
 * 
 * This is used to identify the chat sessions and open them using our custom editor.
 */
const sessionScheme = 'my-session';

/**
 * Use a TextDocumentContentProvider to provide content for chat sessions.
 * 
 * This is could also be implemented using a custom file system.
 */
class MySessionContentProvider implements vscode.TextDocumentContentProvider {
	provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): string {
		// Return some basic content for the session
		// Can be empty if all we need is info in the uri
		return `Chat Session: ${uri.path}\n\nThis is the content of the session.`;
	}
}

/**
 * Create a custom editor for displaying chat sessions.
 */
class MySessionCustomEditor implements vscode.CustomReadonlyEditorProvider {
	openCustomDocument(uri: vscode.Uri, _openContext: vscode.CustomDocumentOpenContext, _token: vscode.CancellationToken): vscode.CustomDocument {
		return {
			uri,
			dispose: () => { }
		};
	}

	resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): void {
		webviewPanel.webview.options = {
			enableScripts: false
		};

		webviewPanel.webview.html = this.getHtmlContent();
	}

	private getHtmlContent(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Chat Session</title>
	<style>
		body {
			margin: 0;
			padding: 0;
			display: flex;
			justify-content: center;
			align-items: center;
			height: 100vh;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		}
		.content {
			text-align: center;
			font-size: 24px;
		}
	</style>
</head>
<body>
	<div class="content">hello world</div>
</body>
</html>`;
	}
}

/**
 * Provides the list of chat sessions 
 */
class MyChatSessionItemProvider implements vscode.ChatSessionItemProvider {
	private readonly _onDidChangeChatSessionItems = new vscode.EventEmitter<void>();
	readonly onDidChangeChatSessionItems = this._onDidChangeChatSessionItems.event;

	private readonly _onDidCommitChatSessionItem = new vscode.EventEmitter<{
		original: vscode.ChatSessionItem;
		modified: vscode.ChatSessionItem;
	}>();
	readonly onDidCommitChatSessionItem = this._onDidCommitChatSessionItem.event;

	private sessions: vscode.ChatSessionItem[] = [];

	constructor() {
		// Create some sample sessions
		this.sessions = [
			{
				id: 'session-1',
				resource: vscode.Uri.parse('my-session:/session-1'),
				label: 'Chat Session 1',
				description: 'First example session',
				status: vscode.ChatSessionStatus.Completed,
				timing: {
					startTime: Date.now() - 3600000, // 1 hour ago
					endTime: Date.now() - 3000000
				}
			},
			{
				id: 'session-2',
				resource: vscode.Uri.parse('my-session:/session-2'),
				label: 'Chat Session 2',
				description: 'Second example session',
				status: vscode.ChatSessionStatus.InProgress,
				timing: {
					startTime: Date.now() - 1800000 // 30 minutes ago
				}
			},
			{
				id: 'session-3',
				resource: vscode.Uri.parse('my-session:/session-3'),
				label: 'Chat Session 3',
				description: 'Third example session',
				status: vscode.ChatSessionStatus.Failed,
				timing: {
					startTime: Date.now() - 7200000, // 2 hours ago
					endTime: Date.now() - 6000000
				}
			}
		];
	}

	async provideChatSessionItems(_token: vscode.CancellationToken): Promise<vscode.ChatSessionItem[]> {
		return this.sessions;
	}
}

export function activate(context: vscode.ExtensionContext) {
	// Register text document content provider for my-session scheme
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(sessionScheme, new MySessionContentProvider()));

	// Register custom editor for showing our sessions
	const customEditor = new MySessionCustomEditor();
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider('mySession.editor', customEditor));

	// Register the chat session item provider
	const sessionProvider = new MyChatSessionItemProvider();
	context.subscriptions.push(
		vscode.chat.registerChatSessionItemProvider(sessionScheme, sessionProvider));
}
