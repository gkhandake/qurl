import * as vscode from 'vscode';
import { QurlPanel } from './QurlPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('Qurl API Client is now active!');

  const openCommand = vscode.commands.registerCommand('qurl.open', () => {
    QurlPanel.render(context.extensionUri, context);
  });

  context.subscriptions.push(openCommand);
}

export function deactivate() {}
