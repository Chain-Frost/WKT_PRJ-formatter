import * as vscode from 'vscode';
import { WktFormatError } from './formatter';
import { formatDefinition } from './definition';
import { ProjFormatError } from './proj-formatter';
import { findWktFolds } from './folding';

function effectiveTabSize(value: number | string | undefined): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 4;
}

function formatted(document: vscode.TextDocument, indent: string): string {
  return formatDefinition(document.getText(), { indent });
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
    vscode.languages.registerFoldingRangeProvider(selector, {
      provideFoldingRanges(document): vscode.FoldingRange[] {
        return findWktFolds(document.getText()).map(
          range => new vscode.FoldingRange(range.start, range.end),
        );
      },
    }),
    vscode.languages.registerDocumentFormattingEditProvider(selector, {
      provideDocumentFormattingEdits(document, options): vscode.TextEdit[] {
        const tabSize = effectiveTabSize(options.tabSize);
        const indent = options.insertSpaces ? ' '.repeat(tabSize) : '\t';
        try {
          const result = formatted(document, indent);
          if (result === document.getText()) {
            return [];
          }
          return [vscode.TextEdit.replace(fullRange(document), result)];
        } catch (error) {
          if (error instanceof WktFormatError || error instanceof ProjFormatError) {
            // Malformed or unsupported WKT/PROJ inputs are left unchanged.
            return [];
          }
          throw error;
        }
      },
    }),
    vscode.commands.registerCommand(
      'wktPrjFormatter.formatDocument',
      async (): Promise<void> => {
        // A command can be invoked from the Command Palette while focus is
        // outside the editor. Use the active editor rather than depending on
        // registerTextEditorCommand's editor-focus precondition.
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) {
          return;
        }
        const tabSize = effectiveTabSize(editor.options.tabSize);
        const indent = editor.options.insertSpaces === false ? '\t' : ' '.repeat(tabSize);
        let result: string;
        try {
          result = formatted(editor.document, indent);
        } catch (error) {
          if (error instanceof WktFormatError || error instanceof ProjFormatError) {
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
