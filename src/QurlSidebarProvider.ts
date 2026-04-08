import * as vscode from 'vscode';
import axios from 'axios';

export class QurlSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'qurl-sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri, private readonly _context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'webview-ui/dist')],
    };

    webviewView.webview.html = this._getWebviewContent(webviewView.webview, this._extensionUri);

    this._setWebviewMessageListener(webviewView.webview);
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
      }
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
        validateStatus: () => true,
      });

      const time = Date.now() - start;

      this._view?.webview.postMessage({
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
      this._view?.webview.postMessage({
        command: 'requestError',
        payload: {
          error: err.message,
          code: err.code,
          config: {
            url: err.config?.url,
            method: err.config?.method,
            headers: err.config?.headers,
            timeout: err.config?.timeout
          }
        }
      });
    }
  }

  private async _handleSaveCollection(payload: any) {
    const { collections } = payload;
    await this._context.globalState.update('qurl.collections', collections);
    // Notify all webviews (sidebar and panel) by posting message back?
    // For now, just save.
    vscode.window.showInformationMessage('Qurl: Collections saved!');
  }

  private _handleLoadCollections() {
    let collections: any = this._context.globalState.get('qurl.collections');
    const initialized = this._context.globalState.get('qurl.initialized');

    if (!initialized || !collections) {
      const folderId = 'example-folder-1';
      collections = [
        {
          id: folderId,
          type: 'folder',
          name: 'Example: JSONPlaceholder',
          parentId: null,
          expanded: true
        },
        {
          id: 'example-req-1',
          type: 'request',
          name: 'Get Post #1',
          parentId: folderId,
          method: 'GET',
          url: 'https://jsonplaceholder.typicode.com/posts/1',
          headers: [{ key: 'Accept', value: 'application/json', active: true }],
          body: ''
        }
      ];
      this._context.globalState.update('qurl.collections', collections);
      this._context.globalState.update('qurl.initialized', true);
    }

    this._view?.webview.postMessage({
      command: 'loadedCollections',
      payload: collections
    });
  }
}
