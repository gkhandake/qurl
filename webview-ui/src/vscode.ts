export function getVscodeApi() {
  if (typeof (window as any).acquireVsCodeApi === 'function') {
    if (!(window as any).vscode) {
      (window as any).vscode = (window as any).acquireVsCodeApi();
    }
    return (window as any).vscode;
  }
  // Mock for browser testing
  return {
    postMessage: (msg: any) => console.log('Mock VSCode Post Message:', msg),
    getState: () => ({}),
    setState: (newState: any) => console.log('Mock VSCode Set State:', newState),
  };
}
