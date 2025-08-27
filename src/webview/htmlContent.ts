import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generates HTML content for development environment
 * @returns HTML string for development environment
 */
export function generateDevHtml(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>PASTA Webview (Dev)</title>
  </head>
  <body>
    <iframe id="pasta-iframe" src="http://localhost:5173" style="width:100vw;height:100vh;border:0"></iframe>
    <script>
      const vscode = acquireVsCodeApi();
      const iframe = document.getElementById('pasta-iframe');
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
}

/**
 * Generates HTML content for production environment
 * @param context Extension context
 * @param webview Webview instance
 * @returns HTML string for production environment
 */
export function generateProdHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const assetsDir = vscode.Uri.joinPath(context.extensionUri, 'webview-ui', 'dist', 'assets');
  const assetFiles = fs.readdirSync(assetsDir.fsPath);

  const jsFile = assetFiles.find((f: string) => /^index-.*\.js$/.test(f));
  const cssFile = assetFiles.find((f: string) => /^index-.*\.css$/.test(f));
  const codiconTtfFile = assetFiles.find((f: string) => /^codicon.*\.ttf$/.test(f));

  if (!jsFile || !cssFile || !codiconTtfFile) {
    throw new Error('Frontend build files are missing. Please make sure you have built the frontend.');
  }

  const codiconTtfUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, codiconTtfFile));

  const svgIconMap = buildSvgIconMap(context, webview, assetsDir, assetFiles);
  const cssContent = processCssContent(assetsDir, cssFile, codiconTtfUri);
  const jsContent = fs.readFileSync(path.join(assetsDir.fsPath, jsFile), 'utf-8');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PASTA Webview</title>
    <style>${cssContent}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.vscode = acquireVsCodeApi();
      window.__SVG_ICON_MAP__ = ${JSON.stringify(svgIconMap)};
    </script>
    <script>${jsContent}</script>
  </body>
</html>`;
}

/**
 * Builds a mapping of SVG icons for production use
 */
function buildSvgIconMap(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  assetsDir: vscode.Uri,
  assetFiles: string[]
): Record<string, string> {
  const svgIconMap: Record<string, string> = {};

  // Process hashed SVGs from assets directory
  for (const file of assetFiles) {
    if (file.endsWith('.svg')) {
      const match = file.match(/^([a-zA-Z0-9_\-]+)\.[a-z0-9]+\.svg$/);
      if (match) {
        const logicalName = match[1] + '.svg';
        svgIconMap[logicalName] = webview.asWebviewUri(
          vscode.Uri.joinPath(assetsDir, file)
        ).toString();
      }
    }
  }

  // Process unhashed SVGs from icons directory
  const iconsDir = vscode.Uri.joinPath(context.extensionUri, 'webview-ui', 'dist', 'icons');
  try {
    const iconFiles = fs.readdirSync(iconsDir.fsPath);
    for (const file of iconFiles) {
      if (file.endsWith('.svg')) {
        svgIconMap[file] = webview.asWebviewUri(
          vscode.Uri.joinPath(iconsDir, file)
        ).toString();
      }
    }
  } catch (e) {
    // iconsDir may not exist if no icons were copied
  }

  return svgIconMap;
}

/**
 * Processes CSS content to replace font paths
 */
function processCssContent(assetsDir: vscode.Uri, cssFile: string, codiconTtfUri: vscode.Uri): string {
  const cssPath = path.join(assetsDir.fsPath, cssFile);
  let cssContent = fs.readFileSync(cssPath, 'utf-8');
  return cssContent.replace(
    /url\((\/assets\/codicon-[^)]*\.ttf[^\)]*)\)/g,
    `url(${codiconTtfUri.toString()})`
  );
} 