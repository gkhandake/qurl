import * as vscode from 'vscode';
import axios from 'axios';

export class QurlPanel {
  public static currentPanel: QurlPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _context: vscode.ExtensionContext;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._panel = panel;
    this._context = context;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
    this._setWebviewMessageListener(this._panel.webview);
  }

  public static render(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    if (QurlPanel.currentPanel) {
      QurlPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        'qurlClient',
        'Qurl',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'webview-ui/dist')],
          retainContextWhenHidden: true,
        }
      );

      QurlPanel.currentPanel = new QurlPanel(panel, extensionUri, context);
    }
  }

  public dispose() {
    QurlPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist', 'assets', 'index.js'));
    const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist', 'assets', 'index.css'));

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" type="text/css" href="${stylesUri}">
        <title>Qurl</title>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command;

        switch (command) {
          case 'sendRequest':
            await this._handleSendRequest(message.payload);
            break;
          case 'saveCollection':
            await this._handleSaveCollection(message.payload);
            break;
          case 'loadCollections':
            this._handleLoadCollections();
            break;
        }
      },
      undefined,
      this._disposables
    );
  }

  private async _handleSendRequest(payload: any) {
    try {
      const { method, url, headers, body } = payload;
      const start = Date.now();
      
      const parsedHeaders = headers.reduce((acc: any, h: any) => {
        if (h.key && h.active) { acc[h.key] = h.value; }
        return acc;
      }, {});

      const response = await axios({
        method: method,
        url: url,
        headers: parsedHeaders,
        data: body ? body : undefined,
        validateStatus: () => true, // Don't throw errors for non-2xx statuses
      });

      const time = Date.now() - start;

      this._panel.webview.postMessage({
        command: 'requestResponse',
        payload: {
          status: response.status,
          statusText: response.statusText,
          time: time,
          headers: response.headers,
          data: response.data,
        }
      });
    } catch (err: any) {
      this._panel.webview.postMessage({
        command: 'requestError',
        payload: {
          error: err.message
        }
      });
    }
  }

  private async _handleSaveCollection(payload: any) {
    const { collections } = payload;
    await this._context.globalState.update('qurl.collections', collections);
    vscode.window.showInformationMessage('Qurl: Collections saved globally!');
  }

  private _handleLoadCollections() {
    const collections = this._context.globalState.get('qurl.collections') || [];
    this._panel.webview.postMessage({
      command: 'loadedCollections',
      payload: collections
    });
  }
}
