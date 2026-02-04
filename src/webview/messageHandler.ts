import * as vscode from 'vscode';
import * as path from 'path';
import { getCodeSummary, getSummaryWithReference, getCodeFromSummaryEdit, getCodeFromDirectInstruction, getSummaryFromInstruction, buildSummaryMapping } from '../llm/llmApi';
import { getLastActiveEditor } from '../extension';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import DiffMatchPatch from 'diff-match-patch';
import { logInteractionFromFrontend } from '../utils/telemetry';
import { ASTCodeLocator } from '../utils/astCodeLocator';
import { ASTMappingProcessor } from '../utils/astMappingProcessor';
import { ASTAnchor } from '../types/astTypes';

// Color palette for summary-code mapping highlights (must match frontend)
const SUMMARY_CODE_MAPPING_COLORS = [
    "#FFB3C6", // pink
    "#B9FBC0", // green
    "#FFD6A5", // orange
    "#D0BFFF", // purple
    "#A3D3FF", // blue
    "#FFDAC1", // peach
    "#FFFACD", // yellow
    "#E0BBE4", // lavender
    "#FEC8D8", // pastel rose
    "#C7CEEA", // periwinkle
    "#B5EAD7", // mint
];

// Constants for code matching
const BITAP_LIMIT = 32;
const MIN_MATCH_SCORE = 0.9;

// Global AST code locator instance
const astLocator = new ASTCodeLocator();
const astMappingProcessor = new ASTMappingProcessor();

// Structured state for the current highlight to avoid races and attach lifecycle disposables
let currentHighlight: {
    id: string;
    decoration: vscode.TextEditorDecorationType;
    editor: vscode.TextEditor;
    disposables: vscode.Disposable[];
} | null = null;

/**
 * Map to track temp file associations for diff/accept/reject workflow.
 * Key: original file path, Value: { tempFilePath: string, range: vscode.Range }
 */
const diffStateMap: Map<string, { tempFilePath: string }> = new Map();

/**
 * Interface for match result
 */
interface MatchResult {
    location: number;
    score?: number;
}

/**
 * Finds the best match for a pattern in text using multiple matching strategies
 * @param text The text to search in
 * @param pattern The pattern to search for
 * @param offset Starting offset for search
 * @param options Matching options
 * @returns MatchResult with location and optional score
 */
function findBestMatch(
    text: string,
    pattern: string,
    offset: number = 0,
    options: {
        caseSensitive?: boolean;
        useFuzzyMatch?: boolean;
        bitapLimit?: number;
        minScore?: number;
    } = {}
): MatchResult {
    const {
        caseSensitive = false,
        useFuzzyMatch = true,
        bitapLimit = BITAP_LIMIT,
        minScore = MIN_MATCH_SCORE
    } = options;

    // 1. Try exact match
    let location = text.indexOf(pattern, offset);
    if (location !== -1) {
        return { location };
    }

    // 2. Try case-insensitive match
    if (!caseSensitive) {
        location = text.toLowerCase().indexOf(pattern.toLowerCase(), offset);
        if (location !== -1) {
            return { location };
        }
    }

    // 3. Try fuzzy match if enabled and pattern is short enough
    if (useFuzzyMatch && pattern.length <= bitapLimit) {
        try {
            const dmp = new DiffMatchPatch();
            location = dmp.match_main(text, pattern, offset);
            if (location !== -1) {
                return { location };
            }
        } catch (e) {
            // Ignore Bitap errors
        }
    }

    // 4. Try sliding window fuzzy match for long patterns
    if (useFuzzyMatch && pattern.length > bitapLimit) {
        let bestScore = 0;
        let bestLocation = -1;
        const dmp = new DiffMatchPatch();

        for (let i = 0; i <= text.length - bitapLimit; i++) {
            const window = text.substr(i, bitapLimit);
            let score = 0;
            try {
                const diffs = dmp.diff_main(window, pattern.substr(0, bitapLimit));
                dmp.diff_cleanupSemantic(diffs);
                let editDistance = 0;
                diffs.forEach((d: [number, string]) => {
                    if (d[0] !== 0) { editDistance += d[1].length; }
                });
                score = (bitapLimit - editDistance) / bitapLimit;
                if (score > bestScore) {
                    bestScore = score;
                    bestLocation = i;
                }
            } catch (e) {
                // Ignore errors
            }
        }

        if (bestScore >= minScore) {
            return { location: bestLocation, score: bestScore };
        }
    }

    return { location: -1 };
}

/**
 * Interface for patch result
 */
interface PatchResult {
    success: boolean;
    patchedText?: string;
    error?: string;
}

/**
 * Applies a patch to the original text
 * @param originalText The original text
 * @param newText The new text to apply
 * @param options Patch options
 * @returns PatchResult with success status and patched text
 */
function applyPatch(
    originalText: string,
    newText: string,
    options: {
        preserveIndentation?: boolean;
    } = {}
): PatchResult {
    const { preserveIndentation = true } = options;

    try {
        // Preserve indentation if needed
        if (preserveIndentation) {
            const originalFirstLineIndent = (originalText.match(/^[ \t]*/)?.[0]) || '';
            if (originalFirstLineIndent && !/^[ \t]/.test(newText.split(/\r?\n/)[0])) {
                newText = originalFirstLineIndent + newText;
            }
        }

        const dmp = new DiffMatchPatch();
        const patchList = dmp.patch_make(originalText, newText);
        const [patchedText, results] = dmp.patch_apply(patchList, originalText);

        if (results.some((applied: boolean) => !applied)) {
            return {
                success: false,
                error: "Failed to apply patch. The code may have changed too much."
            };
        }

        return { success: true, patchedText };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "An unexpected error occurred while applying changes."
        };
    }
}

export async function handleMessage(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    switch (message.command) {
        case 'getSummary':
            await handleGetSummary(message, webviewContainer);
            break;
        case 'summaryPrompt':
            await handleSummaryPrompt(message, webviewContainer);
            break;
        case 'directPrompt':
            await handleDirectPrompt(message, webviewContainer);
            break;
        case 'promptToSummary':
            await handlePromptToSummary(message, webviewContainer);
            break;
        case 'highlightCodeMapping':
            await handleHighlightCodeMapping(message);
            break;
        case 'clearHighlight':
            await handleClearHighlight();
            break;
        case 'selectCodeMapping':
            await handleSelectCodeMapping(message);
            break;
        case 'checkSectionValidity':
            await handleCheckSectionValidity(message, webviewContainer);
            break;
        case 'interactionLog':
            await logInteractionFromFrontend({
                timestamp: message.timestamp,
                source: message.source,
                event: message.event,
                data: message.data
            });
            break;
    }
}

/**
 * Unified code mapping handler that processes code segments with AST-based resolution.
 * Supports both highlight (decorations) and select (editor selection) modes.
 * 
 * SHARED LOGIC:
 * 1. Editor and file path validation
 * 2. Segment filtering
 * 3. AST-based code location resolution
 * 4. Per-line range creation with whitespace trimming
 * 
 * MODE-SPECIFIC LOGIC:
 * - 'highlight': Creates colored background decorations with lifecycle management
 * - 'select': Creates a single editor selection spanning all resolved ranges
 * 
 * @param message The message containing codeSegments, filename, fullPath, and mode-specific params
 * @param mode The operation mode: 'highlight' or 'select'
 */
async function handleCodeMapping(message: any, mode: 'highlight' | 'select') {
    // Mode-specific validation
    if (mode === 'highlight') {
        const { selectedCode, colorIndex } = message;
        if (typeof selectedCode !== "string" || typeof colorIndex !== "number") {
            return;
        }
    } else {
        const { codeSegments } = message;
        if (!Array.isArray(codeSegments) || codeSegments.length === 0) {
            console.warn("[selectCodeMapping] No code segments provided.");
            return;
        }
    }

    // Clear existing highlights if in highlight mode
    if (mode === 'highlight') {
        await handleClearHighlight();
    }

    // Shared: Editor validation
    const editor = getLastActiveEditor();
    if (!editor) {
        if (mode === 'select') {
            console.warn("[selectCodeMapping] No active editor found.");
        }
        return;
    }

    const { selectedCode, codeSegments, colorIndex, filename, fullPath } = message;

    // Shared: File path validation
    const editorPath = editor.document.fileName;
    if (fullPath && editorPath !== fullPath) {
        return;
    }

    // Shared: Document text retrieval
    const docText = editor.document.getText();

    // Highlight mode: Validate region match
    if (mode === 'highlight') {
        const regionMatch = findBestMatch(docText, selectedCode);
        if (regionMatch.location === -1) {
            return;
        }
    }

    // Shared: Range collection
    const allRanges: vscode.Range[] = [];

    // Shared: Segment filtering
    if (Array.isArray(codeSegments) && codeSegments.length > 0) {
        const filteredSegments = codeSegments.filter(
            seg => seg && typeof seg.line === "number" && seg.line > 0
        );

        if (filteredSegments.length === 0 && mode === 'select') {
            console.warn("[selectCodeMapping] No valid code segments after filtering.");
            return;
        }

        // Shared: Helper function for per-line trimming
        const getLineTrimRange = (lineIndex: number, preferredStartChar?: number, preferredEndChar?: number) => {
            const lineText = editor.document.lineAt(lineIndex).text;
            const firstNonWhitespace = Math.max(0, lineText.search(/\S/));
            const lineEnd = lineText.length;

            // If line is empty or whitespace-only, skip it
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
        };

        // Shared: AST resolution loop for each segment
        for (const seg of filteredSegments) {
            console.log(`[VISUAL MAPPING ORIGINAL]`, { code: seg.code, line: seg.line });

            let codeText = seg.code;
            let locateResult: any = null;

            // Shared: AST-based resolution
            if (seg.astNodeRef?.anchor && fullPath) {
                console.log(`  [AST PATH]`, {
                    path: seg.astNodeRef.anchor.path,
                    pathTypes: seg.astNodeRef.anchor.pathTypes,
                    pathNames: seg.astNodeRef.anchor.pathNames
                });

                try {
                    locateResult = await astLocator.locateCode(
                        fullPath,
                        seg.astNodeRef.originalText,
                        seg.astNodeRef.anchor.originalOffset,
                        seg.astNodeRef.anchor
                    );

                    if (locateResult.found && locateResult.currentLines && locateResult.confidence > 0.5) {
                        const oldLine = seg.line;

                        console.log(`  [AST RESOLUTION SUCCESS]`, {
                            method: locateResult.method,
                            originalLine: oldLine,
                            resolvedLine: locateResult.currentLines[0],
                            position: locateResult.currentRange ? {
                                startLine: locateResult.currentRange.startLine,
                                startColumn: locateResult.currentRange.startColumn,
                                endLine: locateResult.currentRange.endLine,
                                endColumn: locateResult.currentRange.endColumn
                            } : null,
                            confidence: locateResult.confidence,
                            codeSnippet: codeText
                        });
                    } else {
                        console.warn(`  [AST RESOLUTION FAILED]`, { method: locateResult.method, confidence: locateResult.confidence });
                        locateResult = null;
                    }
                } catch (error) {
                    console.warn(`  [AST RESOLUTION ERROR] Failed to resolve with AST:`, error);
                    locateResult = null;
                }
            } else {
                console.warn(`  [NO AST REFERENCE] Skipping ${mode} for line ${seg.line}`);
            }

            // Shared: Create ranges from AST resolution result
            const rangesToAdd: vscode.Range[] = [];

            if (locateResult && locateResult.found && locateResult.currentRange) {
                const { startLine, startColumn, endLine, endColumn } = locateResult.currentRange;

                // Validate line numbers are within bounds
                const maxLine = editor.document.lineCount;
                if (startLine < 1 || startLine > maxLine || endLine < 1 || endLine > maxLine) {
                    continue;
                }

                try {
                    if (startLine === endLine) {
                        // Single line: use exact column positions
                        const range = new vscode.Range(
                            new vscode.Position(startLine - 1, startColumn),
                            new vscode.Position(endLine - 1, endColumn)
                        );
                        rangesToAdd.push(range);
                    } else {
                        // Multi-line: first line from startColumn to end, middle lines full, last line from start to endColumn
                        // First line
                        const firstLineText = editor.document.lineAt(startLine - 1).text;
                        rangesToAdd.push(new vscode.Range(
                            new vscode.Position(startLine - 1, startColumn),
                            new vscode.Position(startLine - 1, firstLineText.length)
                        ));

                        // Middle lines (trim leading whitespace)
                        for (let line = startLine; line < endLine - 1; line++) {
                            const range = getLineTrimRange(line);
                            if (range) {
                                rangesToAdd.push(range);
                            }
                        }

                        // Last line
                        const lastLineText = editor.document.lineAt(endLine - 1).text;
                        const lastLineStart = Math.max(0, lastLineText.search(/\S/));
                        rangesToAdd.push(new vscode.Range(
                            new vscode.Position(endLine - 1, lastLineStart),
                            new vscode.Position(endLine - 1, endColumn)
                        ));
                    }
                } catch (error) {
                    continue;
                }
            } else {
                // No AST result, skip this segment
                continue;
            }

            // Add ranges to collection
            allRanges.push(...rangesToAdd);
        }
    }

    // MODE-SPECIFIC: Final application
    if (mode === 'highlight') {
        // Highlight mode: Apply decorations
        if (allRanges.length > 0) {
            const color = SUMMARY_CODE_MAPPING_COLORS[colorIndex % SUMMARY_CODE_MAPPING_COLORS.length] + "80";
            const decorationType = vscode.window.createTextEditorDecorationType({
                backgroundColor: color,
                isWholeLine: false,
                borderRadius: "3px"
            });

            editor.setDecorations(decorationType, allRanges);

            // Create a new highlight record with lifecycle disposables
            const highlightId = uuidv4();
            const disposables: vscode.Disposable[] = [];
            disposables.push(vscode.workspace.onDidChangeTextDocument((e) => {
                if (e.document.fileName === editor.document.fileName) {
                    void handleClearHighlight(highlightId);
                }
            }));
            disposables.push(vscode.workspace.onDidCloseTextDocument((doc) => {
                if (doc.fileName === editor.document.fileName) {
                    void handleClearHighlight(highlightId);
                }
            }));
            disposables.push(vscode.window.onDidChangeActiveTextEditor((active) => {
                if (!active || active.document.fileName !== editor.document.fileName) {
                    void handleClearHighlight(highlightId);
                }
            }));
            currentHighlight = { id: highlightId, decoration: decorationType, editor, disposables };
        } else {
            console.warn("[highlightCodeMapping] No code regions found to highlight.");
        }
    } else {
        // Select mode: Create single selection from first to last range
        if (allRanges.length > 0) {
            // Find the earliest start position and latest end position
            let minStart = allRanges[0].start;
            let maxEnd = allRanges[0].end;

            for (const range of allRanges) {
                if (range.start.isBefore(minStart)) {
                    minStart = range.start;
                }
                if (range.end.isAfter(maxEnd)) {
                    maxEnd = range.end;
                }
            }

            editor.selection = new vscode.Selection(minStart, maxEnd);
            editor.revealRange(new vscode.Range(minStart, maxEnd), vscode.TextEditorRevealType.InCenter);
        } else {
            console.warn("[selectCodeMapping] No code regions found to select.");
        }
    }
}

/**
 * Handles the highlightCodeMapping command from the webview.
 * Delegates to unified handleCodeMapping with 'highlight' mode.
 * 
 * @param message The message containing selectedCode, codeSegments[], colorIndex, filename, fullPath
 */
async function handleHighlightCodeMapping(message: any) {
    await handleCodeMapping(message, 'highlight');
}

/**
 * Handles the clearHighlight command from the webview.
 * Removes any existing highlight decoration from the editor.
 */
async function handleClearHighlight(id?: string) {
    if (!currentHighlight) { return; }
    if (id && currentHighlight.id !== id) { return; }

    try {
        try {
            currentHighlight.editor.setDecorations(currentHighlight.decoration, []);
        } catch (e) {
            // ignore setDecorations errors
        }
        try {
            currentHighlight.decoration.dispose();
        } catch (e) {
            // ignore dispose errors
        }
        for (const d of currentHighlight.disposables) {
            try { d.dispose(); } catch { }
        }
    } finally {
        currentHighlight = null;
    }
}

/**
 * Handles the selectCodeMapping command from the webview.
 * Delegates to unified handleCodeMapping with 'select' mode.
 * 
 * @param message The message containing codeSegments, filename, fullPath
 */
async function handleSelectCodeMapping(message: any) {
    await handleCodeMapping(message, 'select');
}

/**
 * Generates file context including file name, path and content
 * @param filePath The full path of the file
 * @returns Formatted file context string
 */
async function generateFileContext(filePath: string): Promise<string> {
    try {
        const filename = path.basename(filePath);
        const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
        return `File: ${filename}\nPath: ${filePath}\n\nFile Content:\n${fileContent.toString()}`;
    } catch (error) {
        console.error('Error reading file for context:', error);
        return `File: ${path.basename(filePath)}\nPath: ${filePath}\n\nFile Content:\n[Error reading file]`;
    }
}

/**
 * Handles the getSummary command.
 */
async function handleGetSummary(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    // If present, use oldSummaryData from the message (for post-edit summary workflow)
    const oldSummaryData = message.oldSummaryData || undefined;
    // Use newCode from message if present, otherwise use current selection
    const editor = getLastActiveEditor();
    const selectedText = message.newCode || (editor?.document.getText(editor.selection) || '');

    if (!selectedText) {
        webviewContainer.webview.postMessage({
            command: 'summaryResult',
            error: 'No code selected.'
        });
        return;
    }

    try {
        // Stage 1: Generating summary
        webviewContainer.webview.postMessage({
            command: 'summaryProgress',
            stage: 1,
            stageText: 'Generating summary...'
        });
        const filePath = editor?.document.fileName || '';
        const fileContext = await generateFileContext(filePath);

        // Use getSummaryWithReference if oldSummaryData is present, otherwise use getCodeSummary
        let summary;
        if (
            oldSummaryData &&
            oldSummaryData.title &&
            typeof oldSummaryData.low_unstructured === "string" &&
            typeof oldSummaryData.low_structured === "string" &&
            typeof oldSummaryData.medium_unstructured === "string" &&
            typeof oldSummaryData.medium_structured === "string" &&
            typeof oldSummaryData.high_unstructured === "string" &&
            typeof oldSummaryData.high_structured === "string"
        ) {
            // Use originalCode from oldSummaryData context if available, else fallback to selectedText
            const originalCode = oldSummaryData.originalCode || selectedText;
            summary = await getSummaryWithReference(selectedText, originalCode, oldSummaryData, fileContext);
        } else {
            summary = await getCodeSummary(selectedText, fileContext);
        }

        const filename = editor ? path.basename(editor.document.fileName) : '';
        const fullPath = editor?.document.fileName || '';

        // Determine lines and offset based on whether newCode is used
        let lines = '';
        let offset = 0;
        if (message.newCode && editor) {
            // If newCode is present, find its position in the file and use that for lines and offset
            const docText = editor.document.getText();
            const match = findBestMatch(docText, message.newCode);
            if (match.location !== -1) {
                const startPos = editor.document.positionAt(match.location);
                const endPos = editor.document.positionAt(match.location + message.newCode.length);
                lines = `${startPos.line + 1}-${endPos.line + 1}`;
                offset = match.location;
            } else {
                // Fallback to selection if not found
                lines = `${editor.selection.start.line + 1}-${editor.selection.end.line + 1}`;
                offset = editor.document.offsetAt(editor.selection.start);
            }
        } else if (editor) {
            // Use the editor selection as before
            lines = `${editor.selection.start.line + 1}-${editor.selection.end.line + 1}`;
            offset = editor.document.offsetAt(editor.selection.start);
        }

        // ========== SUMMARY MAPPING GENERATION PIPELINE ==========
        // This section creates mappings that link summary components to code segments.
        // The mapping goes through multiple transformations:
        // 1. LLM generates raw mappings with line numbers
        // 2. AST processor adds structural references
        // 3. Final result sent to webview for visualization

        // Stage 2+: Build mapping for all 6 summary types (concurrent)
        const mappingKeys = [
            ["low", "unstructured"],
            ["low", "structured"],
            ["medium", "unstructured"],
            ["medium", "structured"],
            ["high", "unstructured"],
            ["high", "structured"]
        ] as const;

        // Only report progress once before all mappings
        webviewContainer.webview.postMessage({
            command: 'summaryProgress',
            stageText: 'Mapping all summaries...'
        });

        // STEP 1: DETERMINE CODE ANCHOR POSITION
        // Compute real start line (1-based) for mapping anchor
        let realStartLine = 1;
        if (editor) {
            const docText = editor.document.getText();
            const match = findBestMatch(docText, selectedText);
            if (match.location !== -1) {
                const startPos = editor.document.positionAt(match.location);
                realStartLine = startPos.line + 1;
            } else {
                realStartLine = editor.selection.start.line + 1;
            }
        }

        // STEP 2: EXTRACT STRUCTURAL CONTEXT FROM AST
        // This context helps the LLM understand code structure for better mappings
        const structuralContext = fullPath && editor
            ? await astMappingProcessor.getStructuralContext(
                fullPath,
                editor.document.getText(),
                realStartLine,
                realStartLine + selectedText.split('\n').length - 1
            )
            : undefined;

        // STEP 3: LLM GENERATES ORIGINAL INTENDED MAPPINGS
        // For each summary detail level, call LLM to generate code-to-summary mappings
        // buildSummaryMapping:
        //   INPUT:  selectedText (code), summaryText, realStartLine, structuralContext
        //   OUTPUT: Array<{summaryComponent, codeSegments: [{code, line}]}>
        //   - "line" values are from LLM's analysis of the code
        const mappingPromises = mappingKeys.map(([detail, structured]) => {
            const key = `${detail}_${structured}` as keyof typeof summary;
            const summaryText = (summary as any)[key] || "";
            return buildSummaryMapping(selectedText, summaryText, realStartLine, structuralContext);
        });
        const mappingResults = await Promise.all(mappingPromises);

        // STEP 4: AST POST-PROCESSING TO ADD NODE REFERENCES
        // Convert LLM line-based mappings into AST-aware references
        // astMappingProcessor.processMappings:
        //   INPUT:  LLM mappings with line numbers
        //   OUTPUT: Same mappings enhanced with astNodeRef for each code segment
        //   - For each code segment, creates an AST anchor capturing structural info
        //   - This allows later resolution even if code moves slightly
        const enhancedMappingPromises = mappingResults.map(mapping =>
            astMappingProcessor.processMappings(mapping, fullPath, editor?.document.getText() || selectedText)
        );
        const enhancedMappings = await Promise.all(enhancedMappingPromises);

        // STEP 5: ASSEMBLE FINAL SUMMARY MAPPINGS OBJECT
        // Group all enhanced mappings by detail level and structure type
        const summaryMappings: Record<string, any[]> = {};
        mappingKeys.forEach(([detail, structured], idx) => {
            const key = `${detail}_${structured}` as keyof typeof summary;
            summaryMappings[key] = enhancedMappings[idx];
        });

        // STEP 6: CREATE AST ANCHOR FOR ENTIRE CODE SECTION
        // Store structural information about the selected code for future reference
        let astAnchor;
        if (editor && fullPath) {
            const startLine = realStartLine;
            const endLine = startLine + selectedText.split('\n').length - 1;
            astAnchor = await astLocator.createAnchor(
                fullPath,
                selectedText,
                startLine,
                endLine,
                offset
            );
        }

        // STEP 7: SEND COMPLETE RESULT TO WEBVIEW
        // The webview receives:
        // 1. summary: Plain text summaries for all detail/structure combinations
        // 2. summaryMappings: Code segment locations with:
        //    - Original mapping from LLM (codeSegments with line numbers)
        //    - AST references (astNodeRef in each segment)
        //    - Summary components (what each mapping represents)
        // 3. astAnchor: Structural anchor for the entire code section
        // 4. originalCode: The code that was summarized
        // 5. offset: Character offset in the file
        // 
        // When user hovers over a summary component, webview sends highlightCodeMapping with:
        // - codeSegments from summaryMappings (includes line numbers and astNodeRef)
        // - This triggers AST resolution to find current locations before highlighting

        // Final result: send summaryResult to frontend
        webviewContainer.webview.postMessage({
            command: 'summaryResult',
            data: summary,
            filename,
            fullPath,
            lines,
            title: summary.title,
            createdAt: new Date().toLocaleString(),
            originalCode: selectedText,
            offset,
            summaryMappings,
            astAnchor,
            ...(oldSummaryData ? { oldSummaryData } : {})
        });
    } catch (err: any) {
        webviewContainer.webview.postMessage({
            command: 'summaryResult',
            error: 'Failed to get summary from LLM: ' + (err?.message || err)
        });
    }
}

/**
 * Handles the promptToSummary command.
 * This operation only updates the summary using the LLM and does not require a code selection.
 */
async function handlePromptToSummary(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    // Call the LLM to update the summary based on the direct prompt
    const updatedSummary = await getSummaryFromInstruction(
        message.originalCode,
        message.originalSummary,
        message.promptText
    );

    // Return the updated summary to the frontend
    webviewContainer.webview.postMessage({
        command: 'editResult',
        sectionId: message.sectionId,
        action: 'promptToSummary',
        newCode: updatedSummary
    });
}

/**
 * Handles the summaryPrompt command with fuzzy patching.
 */
async function handleSummaryPrompt(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    const { originalCode, filename, fullPath } = message;
    if (!originalCode || !(filename || fullPath)) {
        webviewContainer.webview.postMessage({
            command: 'editResult',
            sectionId: message.sectionId,
            action: 'summaryPrompt',
            error: 'Missing original code or filename.'
        });
        return;
    }

    const filePath = fullPath || path.join(vscode.workspace.rootPath || '', filename);
    const fileContext = await generateFileContext(filePath);
    const newCode = await getCodeFromSummaryEdit(
        originalCode,
        message.summaryText,
        message.detailLevel,
        message.structuredType,
        fileContext,
        message.originalSummary
    );

    await applyCodeChanges(webviewContainer, message, originalCode, newCode, filename, fullPath, 'summaryPrompt');
}

/**
 * Handles the directPrompt command with fuzzy patching.
 */
async function handleDirectPrompt(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    const { originalCode, filename, fullPath } = message;
    if (!originalCode || !(filename || fullPath)) {
        webviewContainer.webview.postMessage({
            command: 'editResult',
            sectionId: message.sectionId,
            action: 'directPrompt',
            error: 'Missing original code or filename.'
        });
        return;
    }

    const filePath = fullPath || path.join(vscode.workspace.rootPath || '', filename);
    const fileContext = await generateFileContext(filePath);
    const newCode = await getCodeFromDirectInstruction(originalCode, message.promptText, fileContext);
    await applyCodeChanges(webviewContainer, message, originalCode, newCode, filename, fullPath, 'directPrompt');
}

/**
 * Applies a fuzzy patch to the file, replacing the matched region with new code.
 * This function is used by both directPrompt and editSummaryPrompt handlers.
 * Returns { success: boolean, patchedText?: string, error?: string }
 */
async function applyFuzzyPatchAndReplaceInFile(
    fileUri: vscode.Uri,
    document: vscode.TextDocument,
    originalCode: string,
    newCode: string,
    offset: number
): Promise<{ success: boolean; patchedText?: string; error?: string }> {
    try {
        const fileText = document.getText();

        // Find the location of the original code in the file
        const match = findBestMatch(fileText, originalCode, offset);
        if (match.location === -1) {
            return { success: false, error: "Could not find the original code in the file. The code may have changed too much." };
        }

        // Apply the patch
        const patchResult = applyPatch(originalCode, newCode);
        if (!patchResult.success) {
            return patchResult;
        }

        const edit = new vscode.WorkspaceEdit();
        const start = document.positionAt(match.location);
        const end = document.positionAt(match.location + originalCode.length);
        edit.replace(fileUri, new vscode.Range(start, end), patchResult.patchedText!);

        const success = await vscode.workspace.applyEdit(edit);
        if (!success) {
            return { success: false, error: "Failed to apply edit to the file." };
        }

        return { success: true, patchedText: patchResult.patchedText };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "An unexpected error occurred while applying changes."
        };
    }
}

/**
 * Opens a file and returns its document and URI
 * @param filename The filename to open
 * @param fullPath The full path to the file
 * @returns Object containing the document and URI, or null if file cannot be opened
 */
async function openFile(filename: string, fullPath: string): Promise<{ document: vscode.TextDocument; fileUri: vscode.Uri } | null> {
    const fileUri = fullPath
        ? vscode.Uri.file(fullPath)
        : vscode.Uri.file(path.isAbsolute(filename) ? filename : path.join(vscode.workspace.rootPath || "", filename));

    try {
        // Check if file exists before opening
        let fileExists = true;
        try {
            await vscode.workspace.fs.stat(fileUri);
        } catch (e) {
            fileExists = false;
        }
        if (!fileExists) {
            return null;
        }
        const document = await vscode.workspace.openTextDocument(fileUri);
        return { document, fileUri };
    } catch (err) {
        return null;
    }
}

/**
 * Common function to apply code changes to a file.
 * Accepts either a WebviewPanel or WebviewView as the webview container.
 * @param webviewContainer The webview panel or view instance
 * @param message The original message
 * @param originalCode The original code to be replaced
 * @param newCode The new code to replace with
 * @param filename The filename
 * @param fullPath The full path to the file
 * @param action The action type (directPrompt or editSummaryPrompt)
 */
async function applyCodeChanges(
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView,
    message: any,
    originalCode: string,
    newCode: string,
    filename: string,
    fullPath: string,
    action: 'directPrompt' | 'summaryPrompt'
) {
    try {
        const fileInfo = await openFile(filename, fullPath);
        if (!fileInfo) {
            webviewContainer.webview.postMessage({
                command: 'editResult',
                sectionId: message.sectionId,
                action,
                error: `File not found: ${filename}. Please check that the file exists in your workspace.`
            });
            return;
        }

        const { document, fileUri } = fileInfo;
        const offset = typeof message.offset === "number" ? message.offset : 0;

        // --- Save original code to a temp file before patching ---
        // Generate a unique temp file path
        const tempFilePath = path.join(os.tmpdir(), `naturaledit_${uuidv4()}_${filename}`);
        // Write the original code to the temp file
        fs.writeFileSync(tempFilePath, document.getText(), 'utf8');

        // Track the temp file for this file
        diffStateMap.set(fileUri.fsPath, { tempFilePath });

        // --- Apply the patch ---
        const result = await applyFuzzyPatchAndReplaceInFile(fileUri, document, originalCode, newCode, offset);

        if (!result.success) {
            webviewContainer.webview.postMessage({
                command: 'editResult',
                sectionId: message.sectionId,
                action,
                error: result.error
            });
            // Clean up temp file if patch failed
            try { fs.unlinkSync(tempFilePath); } catch { }
            diffStateMap.delete(fileUri.fsPath);
            return;
        }

        // --- Open the diff view between temp file (original) and modified file ---
        const tempFileUri = vscode.Uri.file(tempFilePath);
        await vscode.commands.executeCommand(
            'vscode.diff',
            tempFileUri,
            fileUri,
            `Review Edits: ${filename}`
        );

        // Optionally, focus the diff editor (VSCode will usually do this automatically)

        // --- After patch, notify frontend with the new code ---
        const patchedText = result.patchedText || "";
        webviewContainer.webview.postMessage({
            command: 'editResult',
            sectionId: message.sectionId,
            action,
            newCode: patchedText
        });
    } catch (error) {
        webviewContainer.webview.postMessage({
            command: 'editResult',
            sectionId: message.sectionId,
            action,
            error: error instanceof Error ? error.message : "An unexpected error occurred."
        });
    }
}

/**
 * Handles the checkSectionValidity command.
 * Checks if the file exists and if the original code can be matched.
 * Uses AST-based location with fallback to text matching.
 * If matched, opens the file and navigates to the match.
 * @param message The message containing fullPath, originalCode, offset, and optional astAnchor
 * @param webviewContainer The webview panel or view instance
 */
async function handleCheckSectionValidity(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    const { fullPath, originalCode, offset, astAnchor } = message;
    if (!fullPath || !originalCode) {
        webviewContainer.webview.postMessage({
            command: 'sectionValidityResult',
            status: 'file_missing'
        });
        return;
    }

    // Try to open the file
    const fileInfo = await openFile("", fullPath);
    if (!fileInfo) {
        webviewContainer.webview.postMessage({
            command: 'sectionValidityResult',
            status: 'file_missing'
        });
        return;
    }

    const { document } = fileInfo;

    // Try AST-based location first (if anchor provided), then fallback to text matching
    try {
        const locateResult = await astLocator.locateCode(
            fullPath,
            originalCode,
            offset || 0,
            astAnchor as ASTAnchor | undefined
        );

        if (!locateResult.found || locateResult.confidence < 0.5) {
            webviewContainer.webview.postMessage({
                command: 'sectionValidityResult',
                status: 'code_not_matched',
                method: locateResult.method,
                confidence: locateResult.confidence
            });
            return;
        }

        // If matched, open the file and navigate to the match location
        try {
            const editor = await vscode.window.showTextDocument(document, { preview: false });
            if (locateResult.currentLines) {
                const [startLine, endLine] = locateResult.currentLines;
                const start = new vscode.Position(startLine - 1, 0);
                const end = document.lineAt(Math.min(endLine - 1, document.lineCount - 1)).range.end;
                editor.selection = new vscode.Selection(start, end);
                editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
            }
        } catch (e) {
            // Ignore navigation errors, still report success
        }

        webviewContainer.webview.postMessage({
            command: 'sectionValidityResult',
            status: 'success',
            method: locateResult.method,
            confidence: locateResult.confidence,
            currentLines: locateResult.currentLines
        });
    } catch (error) {
        webviewContainer.webview.postMessage({
            command: 'sectionValidityResult',
            status: 'code_not_matched',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
