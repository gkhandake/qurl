import * as vscode from 'vscode';
import { QurlPanel } from './QurlPanel';
import { QurlSidebarProvider } from './QurlSidebarProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Qurl API Client is now active!');

  const sidebarProvider = new QurlSidebarProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(QurlSidebarProvider.viewType, sidebarProvider)
  );

  const openCommand = vscode.commands.registerCommand('qurl.open', () => {
    QurlPanel.render(context.extensionUri, context);
  });

  context.subscriptions.push(openCommand);
}

export function deactivate() {}
