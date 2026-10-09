import * as vscode from 'vscode';
import { formatWkt, WktFormatError } from './formatter';

function formatted(document: vscode.TextDocument, indent: string): string {
  const maxInlineLength = vscode.workspace.getConfiguration('wktPrjFormatter', document.uri)
    .get<number>('maxInlineLength', 100);
  return formatWkt(document.getText(), { indent, maxInlineLength });
}

function fullRange(document: vscode.TextDocument): vscode.Range {
  return new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
}

export function activate(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [
    { language: 'wkt' },
    { pattern: '**/*.prj' },
    { pattern: '**/*.wkt' },
    { pattern: '**/*.wkt2' },
  ];

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(selector, {
      provideDocumentFormattingEdits(document, options): vscode.TextEdit[] {
        const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
        try {
          const result = formatted(document, indent);
          if (result === document.getText()) {
            return [];
          }
          return [vscode.TextEdit.replace(fullRange(document), result)];
        } catch (error) {
          if (error instanceof WktFormatError) {
            // Unsupported/non-WKT PRJ and malformed WKT are left unchanged.
            return [];
          }
          throw error;
        }
      },
    }),
    vscode.commands.registerTextEditorCommand(
      'wktPrjFormatter.formatDocument',
      async (editor: vscode.TextEditor): Promise<void> => {
        const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4;
        const indent = editor.options.insertSpaces === false ? '\t' : ' '.repeat(tabSize);
        let result: string;
        try {
          result = formatted(editor.document, indent);
        } catch (error) {
          if (error instanceof WktFormatError) {
            void vscode.window.showWarningMessage('WKT / PRJ Formatter: ' + error.message);
            return;
          }
          throw error;
        }

        if (result !== editor.document.getText()) {
          await editor.edit(edit => edit.replace(fullRange(editor.document), result), {
            undoStopBefore: true,
            undoStopAfter: true,
          });
        }
      },
    ),
  );
}

export function deactivate(): void {}
