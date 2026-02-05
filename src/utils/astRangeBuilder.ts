import * as vscode from 'vscode';
import { ASTCodeLocator } from './astCodeLocator';
import { ASTAnchor, ASTLocateResult } from '../types/astTypes';

/**
 * Unified utility module for AST-based range building and code location.
 * Provides reusable functions to handle multi-segment AST resolution and range construction.
 */

/**
 * Resolve code location using AST-based strategies with optional text matching fallback.
 * 
 * This is a wrapper around ASTCodeLocator that provides:
 * - Unified interface for all AST resolution calls
 * - Confidence-based validation
 * - Consistent error handling and logging
 * 
 * @param filePath Path to the source file
 * @param originalCode The code snippet to locate
 * @param offset Character offset hint
 * @param astAnchor Optional AST anchor for structural navigation
 * @param astLocator AST code locator instance
 * @returns ASTLocateResult with location and confidence information
 */
export async function resolveCodeWithAST(
    filePath: string,
    originalCode: string,
    offset: number,
    astAnchor: ASTAnchor | undefined,
    astLocator: ASTCodeLocator
): Promise<ASTLocateResult> {
    try {
        const result = await astLocator.locateCode(
            filePath,
            originalCode,
            offset,
            astAnchor
        );

        if (result.found && result.confidence > 0) {
            console.log('[AST RESOLUTION] Success', {
                method: result.method,
                confidence: result.confidence,
                lines: result.currentLines,
                offset
            });
            return result;
        } else {
            console.warn('[AST RESOLUTION] Failed', {
                method: result.method,
                confidence: result.confidence,
                error: result.error
            });
            return result;
        }
    } catch (error) {
        console.error('[AST RESOLUTION] Error during resolution:', error);
        return {
            found: false,
            method: 'not-found',
            confidence: 0,
            error: error instanceof Error ? error.message : 'Unknown error during AST resolution'
        };
    }
}

/**
 * Build VSCode Range array from AST location result, handling single/multi-line cases.
 * 
 * For multi-line results, creates separate ranges for:
 * - First line: from startColumn to end of line
 * - Middle lines: trimmed whitespace to end of line
 * - Last line: trimmed whitespace to endColumn
 * 
 * @param document The text document for line information
 * @param astResult The AST resolution result containing line/column info
 * @returns Array of VSCode Range objects, or empty array if result invalid
 */
export function buildRangesFromASTResult(
    document: vscode.TextDocument,
    astResult: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    }
): vscode.Range[] {
    const { startLine, startColumn, endLine, endColumn } = astResult;
    const ranges: vscode.Range[] = [];

    try {
        // Validate line numbers
        const maxLine = document.lineCount;
        if (startLine < 1 || startLine > maxLine || endLine < 1 || endLine > maxLine) {
            console.warn('[BUILD RANGES] Invalid line numbers', {
                startLine,
                endLine,
                maxLine
            });
            return [];
        }

        if (startLine === endLine) {
            // Single line: use exact column positions
            const range = new vscode.Range(
                new vscode.Position(startLine - 1, startColumn),
                new vscode.Position(endLine - 1, endColumn)
            );
            ranges.push(range);
        } else {
            // Multi-line: decompose into first, middle, last

            // First line: from startColumn to end
            const firstLineText = document.lineAt(startLine - 1).text;
            ranges.push(new vscode.Range(
                new vscode.Position(startLine - 1, startColumn),
                new vscode.Position(startLine - 1, firstLineText.length)
            ));

            // Middle lines: trimmed to end
            for (let line = startLine; line < endLine - 1; line++) {
                const range = getLineTrimRange(document, line);
                if (range) {
                    ranges.push(range);
                }
            }

            // Last line: trimmed to endColumn
            const lastLineText = document.lineAt(endLine - 1).text;
            const lastLineStart = Math.max(0, lastLineText.search(/\S/));
            ranges.push(new vscode.Range(
                new vscode.Position(endLine - 1, lastLineStart),
                new vscode.Position(endLine - 1, endColumn)
            ));
        }

        return ranges;
    } catch (error) {
        console.error('[BUILD RANGES] Error building ranges:', error);
        return [];
    }
}

/**
 * Get a trimmed line range (skipping leading whitespace).
 * Used for middle and last lines in multi-line selections.
 * 
 * @param document The text document
 * @param lineIndex 0-based line index
 * @param preferredStartChar Optional column to start from
 * @param preferredEndChar Optional column to end at
 * @returns VSCode Range for the trimmed line, or null if line is empty
 */
export function getLineTrimRange(
    document: vscode.TextDocument,
    lineIndex: number,
    preferredStartChar?: number,
    preferredEndChar?: number
): vscode.Range | null {
    try {
        const lineText = document.lineAt(lineIndex).text;
        const firstNonWhitespace = Math.max(0, lineText.search(/\S/));
        const lineEnd = lineText.length;

        // Skip empty or whitespace-only lines
        if (lineText.trim().length === 0) {
            return null;
        }

        const startChar = preferredStartChar !== undefined
            ? Math.max(preferredStartChar, firstNonWhitespace)
            : firstNonWhitespace;
        const endChar = preferredEndChar !== undefined ? preferredEndChar : lineEnd;

        return new vscode.Range(
            new vscode.Position(lineIndex, startChar),
            new vscode.Position(lineIndex, Math.max(startChar, endChar))
        );
    } catch (error) {
        console.warn('[GET LINE TRIM RANGE] Error on line', lineIndex, error);
        return null;
    }
}

/**
 * Validate if a location result represents a confident match.
 * Encapsulates the confidence threshold logic.
 * 
 * @param result The AST location result
 * @param confidenceThreshold Minimum confidence required (default 0.5)
 * @returns true if result is found and confidence meets threshold
 */
export function isConfidentMatch(
    result: ASTLocateResult,
    confidenceThreshold: number = 0.5
): boolean {
    return result.found && result.confidence >= confidenceThreshold;
}