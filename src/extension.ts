import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let webviewPanel: vscode.WebviewPanel | undefined = undefined;

	const openWebviewCommand = vscode.commands.registerCommand('modmap.openWebview', () => {
		webviewPanel = vscode.window.createWebviewPanel('modmapWebview', 'ModMap', vscode.ViewColumn.Two, { enableScripts: true });
		webviewPanel.webview.html = `<!DOCTYPE html>
			<html>
				<head><meta charset="UTF-8"></head>
				<body>
					<iframe src="http://localhost:5173" style="width:100%;height:100vh;border:0"></iframe>
					<script>
						const vscode = acquireVsCodeApi();
						const iframe = document.querySelector('iframe');
						window.addEventListener('message', e => {
							if (e.source === iframe?.contentWindow) {
								vscode.postMessage(e.data);
							} else if (e.origin.startsWith('vscode-webview://')) {
								iframe?.contentWindow?.postMessage(e.data, '*');
							}
						});
					</script>
				</body>
			</html>`;
		webviewPanel.onDidDispose(() => {
			webviewPanel = undefined;
		});

		webviewPanel.webview.onDidReceiveMessage(message => {
			if (message.command === 'hello') {
				vscode.window.showInformationMessage(message.text);
			}
		});
	});

	const sendHelloCommand = vscode.commands.registerCommand('modmap.hello2Webview', () => {
		if (webviewPanel) {
			webviewPanel.webview.postMessage({
				command: 'hello',
				text: 'Hello from VSCode!'
			});
		} else {
			vscode.window.showInformationMessage('WebView is not open!');
		}
	});

	context.subscriptions.push(openWebviewCommand, sendHelloCommand);
}

export function deactivate() { }
