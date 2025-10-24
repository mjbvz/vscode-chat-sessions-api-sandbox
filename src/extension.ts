import * as vscode from "vscode";

/**
 * URI scheme used for our chat sessions
 *
 * This is used to identify the chat sessions and open them using our custom editor.
 */
const sessionScheme = "my-session";

const sampleSessions: vscode.ChatSessionItem[] = [
	{
		resource: vscode.Uri.parse("my-session:/session-1"),
		label: "Chat Session 1",
		description: "First example session",
		status: vscode.ChatSessionStatus.Completed,
		timing: {
			startTime: Date.now() - 3600000, // 1 hour ago
			endTime: Date.now() - 3000000,
		},
	},
	{
		resource: vscode.Uri.parse("my-session:/session-2"),
		label: "Chat Session 2",
		description: "Second example session",
		status: vscode.ChatSessionStatus.InProgress,
		timing: {
			startTime: Date.now() - 1800000, // 30 minutes ago
		},
	},
	{
		resource: vscode.Uri.parse("my-session:/session-3"),
		label: "Chat Session 3",
		description: "Third example session",
		status: vscode.ChatSessionStatus.Failed,
		timing: {
			startTime: Date.now() - 7200000, // 2 hours ago
			endTime: Date.now() - 6000000,
		},
	},
];

/**
 * Simple readonly file system for chat sessions.
 */
class MySessionFileSystem implements vscode.FileSystemProvider {
	private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	readonly onDidChangeFile = this._onDidChangeFile.event;

	private readonly _onDidMoveFile = new vscode.EventEmitter<void>();
	readonly onDidMoveFile = this._onDidMoveFile.event;

	watch(_uri: vscode.Uri): vscode.Disposable {
		// No-op for readonly file system
		return new vscode.Disposable(() => { });
	}

	stat(uri: vscode.Uri): vscode.FileStat {
		for (const session of sampleSessions) {
			if (session.resource.toString() === uri.toString()) {
				return {
					type: vscode.FileType.File,
					ctime: Date.now(),
					mtime: Date.now(),
					size: 0,
				};
			}
		}
		throw vscode.FileSystemError.FileNotFound(uri);
	}

	readDirectory(_uri: vscode.Uri): [string, vscode.FileType][] {
		// Not needed for our use case
		return [];
	}

	createDirectory(_uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions('readonly');
	}

	readFile(uri: vscode.Uri): Uint8Array {
		for (const session of sampleSessions) {
			if (session.resource.toString() === uri.toString()) {
				// Return some basic content for the session
				const content = `Chat Session: ${uri.path}\n\nThis is the content of the session.`;
				return new TextEncoder().encode(content);
			}
		}
		throw vscode.FileSystemError.FileNotFound(uri);
	}

	writeFile(_uri: vscode.Uri, _content: Uint8Array, _options: { create: boolean; overwrite: boolean }): void {
		throw vscode.FileSystemError.NoPermissions('readonly');
	}

	delete(_uri: vscode.Uri): void {
		throw vscode.FileSystemError.NoPermissions('readonly');
	}

	rename(_oldUri: vscode.Uri, _newUri: vscode.Uri): void {
		this._onDidMoveFile.fire();
	}
}

/**
 * Create a custom editor for displaying chat sessions.
 */
class MySessionCustomEditor implements vscode.CustomTextEditorProvider {

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	async moveCustomTextEditor?(_newDocument: vscode.TextDocument, _existingWebviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
		return;
	}

	resolveCustomTextEditor(_document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> | void {
		webviewPanel.title = `my Chat Session`;
		webviewPanel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'icon.png');

		webviewPanel.webview.options = {
			enableScripts: true,
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
	<div class="content">
		<div>hello world</div>
		<div>Counter: <span id="counter">0</span></div>
	</div>
	<script>
		let count = 0;
		const counterElement = document.getElementById('counter');
		
		setInterval(() => {
			count++;
			counterElement.textContent = count;
		}, 1000);
	</script>
</body>
</html>`;
	}
}

/**
 * Provides the list of chat sessions
 */
class MyChatSessionItemProvider implements vscode.ChatSessionItemProvider {
	public readonly _onDidChangeChatSessionItems = new vscode.EventEmitter<void>();
	public readonly onDidChangeChatSessionItems = this._onDidChangeChatSessionItems.event;

	private readonly _onDidCommitChatSessionItem = new vscode.EventEmitter<{
		original: vscode.ChatSessionItem;
		modified: vscode.ChatSessionItem;
	}>();
	readonly onDidCommitChatSessionItem = this._onDidCommitChatSessionItem.event;

	private sessions = sampleSessions;

	async provideChatSessionItems(
		_token: vscode.CancellationToken
	): Promise<vscode.ChatSessionItem[]> {
		return this.sessions;
	}
}

export function activate(context: vscode.ExtensionContext) {
	const sessionFs = new MySessionFileSystem();

	// Register readonly file system for my-session scheme
	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider(
			sessionScheme,
			sessionFs,
			{ isReadonly: false }
		)
	);

	// Register custom editor for showing our sessions
	const customEditor = new MySessionCustomEditor(context);
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider("mySession.editor", customEditor, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		})
	);

	// Register the chat session item provider
	const sessionProvider = new MyChatSessionItemProvider();
	context.subscriptions.push(
		vscode.chat.registerChatSessionItemProvider(sessionScheme, sessionProvider)
	);

	// Register commands
	vscode.commands.registerCommand("chat-session-sandbox.test-move", async () => {
		const workspaceEdit = new vscode.WorkspaceEdit();
		const from = vscode.Uri.parse("my-session:/session-1");
		const to = vscode.Uri.parse("my-session:/moved-session-1");
		workspaceEdit.renameFile(from, to);

		const sub = sessionFs.onDidMoveFile(() => {
			sampleSessions[0].resource = to;
			sub.dispose();
		});

		await vscode.workspace.applyEdit(workspaceEdit);

		sub.dispose();

		sessionProvider._onDidChangeChatSessionItems.fire();
	});

	vscode.commands.registerCommand("chat-session-sandbox.exampleInlineAction", () => {
		vscode.window.showWarningMessage("Example inline action executed!");
	});

	vscode.commands.registerCommand("chat-session-sandbox.exampleCreateAction1", () => {
		vscode.window.showWarningMessage("Example create action 1 executed!");
	});

	vscode.commands.registerCommand("chat-session-sandbox.exampleCreateAction2", () => {
		vscode.window.showWarningMessage("Example create action 2 executed!");
	});
}