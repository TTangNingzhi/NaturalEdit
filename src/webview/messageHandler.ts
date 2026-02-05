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
import { resolveCodeWithAST, buildRangesFromASTResult, isConfidentMatch } from '../utils/astRangeBuilder';

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
 * 3. AST-based code location resolution (via resolveCodeWithAST)
 * 4. Range creation from AST results (via buildRangesFromASTResult)
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

        // Shared: AST resolution loop for each segment
        for (const seg of filteredSegments) {
            console.log(`[VISUAL MAPPING] Processing segment`, { code: seg.code, line: seg.line });

            // Use AST-based resolution if anchor available
            if (seg.astNodeRef?.anchor && fullPath) {
                console.log(`  [AST PATH]`, {
                    path: seg.astNodeRef.anchor.path,
                    pathTypes: seg.astNodeRef.anchor.pathTypes,
                    pathNames: seg.astNodeRef.anchor.pathNames
                });

                const locateResult = await resolveCodeWithAST(
                    fullPath,
                    seg.astNodeRef.originalText,
                    seg.astNodeRef.anchor.originalOffset,
                    seg.astNodeRef.anchor,
                    astLocator
                );

                if (isConfidentMatch(locateResult, 0.5) && locateResult.currentRange) {
                    console.log(`  [AST RESOLUTION SUCCESS]`, {
                        method: locateResult.method,
                        originalLine: seg.line,
                        resolvedLine: locateResult.currentLines?.[0],
                        confidence: locateResult.confidence
                    });

                    // Build ranges using utility function
                    const rangesToAdd = buildRangesFromASTResult(editor.document, locateResult.currentRange);
                    allRanges.push(...rangesToAdd);
                } else {
                    console.warn(`  [AST RESOLUTION FAILED]`, {
                        confidence: locateResult.confidence,
                        error: locateResult.error
                    });
                }
            } else {
                console.warn(`  [NO AST REFERENCE] Skipping ${mode} for line ${seg.line}`);
            }
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
 * Apply code changes to a file using AST-based location, with fallback to text matching.
 * 
 * Priority:
 * 1. AST-based location if anchor provided (most reliable)
 * 2. Text matching fallback if AST unavailable or confidence below threshold
 * 
 * @param fileUri URI of the file to modify
 * @param document The text document
 * @param originalCode The code to find and replace
 * @param newCode The replacement code
 * @param offset Character offset hint
 * @param filePath Full file path for AST locator
 * @param astAnchor Optional AST anchor for structural navigation
 * @returns Result with success status, patched text, and error info
 */
async function applyFuzzyPatchAndReplaceInFile(
    fileUri: vscode.Uri,
    document: vscode.TextDocument,
    originalCode: string,
    newCode: string,
    offset: number,
    filePath: string,
    astAnchor?: ASTAnchor
): Promise<{ success: boolean; patchedText?: string; error?: string }> {
    try {
        const fileText = document.getText();
        let startPosition: vscode.Position | null = null;
        let endPosition: vscode.Position | null = null;
        let locateMethod = 'text-match';

        // Strategy 1: Try AST-based location first
        if (astAnchor && filePath) {
            console.log('[APPLY CHANGES] Attempting AST-based code location');

            const locateResult = await resolveCodeWithAST(
                filePath,
                originalCode,
                offset,
                astAnchor,
                astLocator
            );

            if (isConfidentMatch(locateResult, 0.5) && locateResult.currentRange) {
                // Use AST's exact range (1-based line, 0-based column)
                startPosition = new vscode.Position(
                    locateResult.currentRange.startLine - 1,
                    locateResult.currentRange.startColumn
                );
                endPosition = new vscode.Position(
                    locateResult.currentRange.endLine - 1,
                    locateResult.currentRange.endColumn
                );

                locateMethod = 'ast-based';

                console.log('[APPLY CHANGES] AST location successful', {
                    confidence: locateResult.confidence,
                    startLine: locateResult.currentRange.startLine,
                    startColumn: locateResult.currentRange.startColumn,
                    endLine: locateResult.currentRange.endLine,
                    endColumn: locateResult.currentRange.endColumn,
                    lines: locateResult.currentLines
                });
            } else {
                console.warn('[APPLY CHANGES] AST location confidence too low', {
                    confidence: locateResult.confidence,
                    error: locateResult.error
                });
                // Fall through to text matching
            }
        }

        // Strategy 2: Fallback to text matching if AST failed or unavailable
        if (!startPosition || !endPosition) {
            console.log('[APPLY CHANGES] Falling back to text matching');

            const match = findBestMatch(fileText, originalCode, offset);
            if (match.location !== -1) {
                startPosition = document.positionAt(match.location);
                endPosition = document.positionAt(match.location + originalCode.length);
                locateMethod = 'text-match';

                console.log('[APPLY CHANGES] Text matching successful', {
                    location: match.location,
                    score: match.score
                });
            } else {
                return {
                    success: false,
                    error: 'Could not locate the code in the file. The code may have been modified significantly.'
                };
            }
        }

        // Apply the patch
        const patchResult = applyPatch(originalCode, newCode);
        if (!patchResult.success) {
            console.error('[APPLY CHANGES] Patch generation failed', patchResult);
            return patchResult;
        }

        console.log('[APPLY CHANGES] Patch generated successfully', {
            method: locateMethod,
            originalLength: originalCode.length,
            patchedLength: patchResult.patchedText?.length
        });

        // Apply edit to document using the precise range
        const edit = new vscode.WorkspaceEdit();
        edit.replace(fileUri, new vscode.Range(startPosition, endPosition), patchResult.patchedText!);

        const success = await vscode.workspace.applyEdit(edit);
        if (!success) {
            return {
                success: false,
                error: 'Failed to apply edit to the file. The file may be read-only or locked.'
            };
        }

        console.log('[APPLY CHANGES] Edit applied successfully', {
            method: locateMethod,
            startLine: startPosition.line + 1,
            endLine: endPosition.line + 1
        });

        return { success: true, patchedText: patchResult.patchedText };
    } catch (error) {
        console.error('[APPLY CHANGES] Unexpected error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'An unexpected error occurred while applying changes.'
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
        const astAnchor = message.astAnchor ? (message.astAnchor as ASTAnchor | undefined) : undefined;
        const result = await applyFuzzyPatchAndReplaceInFile(
            fileUri,
            document,
            originalCode,
            newCode,
            offset,
            fullPath,
            astAnchor
        );

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
 * Uses AST-based location to resolve code segments independently, handling parallel nodes correctly.
 * If matched, opens the file and navigates to highlight all matched regions.
 * 
 * Message format: {
 *   fullPath: string,
 *   codeSegments: Array<{code: string, line: number, astNodeRef?: {anchor: ASTAnchor, originalText: string}}>,
 *   filename?: string
 * }
 * 
 * @param message The message containing fullPath, codeSegments array with individual AST node refs
 * @param webviewContainer The webview panel or view instance
 */
async function handleCheckSectionValidity(
    message: any,
    webviewContainer: vscode.WebviewPanel | vscode.WebviewView
) {
    const { fullPath, codeSegments, filename } = message;

    if (!fullPath || !Array.isArray(codeSegments) || codeSegments.length === 0) {
        webviewContainer.webview.postMessage({
            command: 'sectionValidityResult',
            status: 'file_missing'
        });
        return;
    }

    try {
        // Try to open the file
        const fileInfo = await openFile(filename || "", fullPath);
        if (!fileInfo) {
            webviewContainer.webview.postMessage({
                command: 'sectionValidityResult',
                status: 'file_missing'
            });
            return;
        }

        const { document } = fileInfo;

        // Resolve each segment independently using AST
        const segmentResults: Array<{
            segment: any;
            locateResult: any;
            ranges: vscode.Range[];
        }> = [];

        for (const seg of codeSegments) {
            if (!seg || typeof seg.line !== 'number' || seg.line <= 0) {
                continue;
            }

            let locateResult = null;

            // Use AST-based resolution if anchor available
            if (seg.astNodeRef?.anchor && fullPath) {
                console.log('[SECTION VALIDITY] Resolving segment with AST', {
                    line: seg.line,
                    pathLength: seg.astNodeRef.anchor.path.length
                });

                locateResult = await resolveCodeWithAST(
                    fullPath,
                    seg.astNodeRef.originalText,
                    seg.astNodeRef.anchor.originalOffset,
                    seg.astNodeRef.anchor,
                    astLocator
                );
            } else {
                console.warn('[SECTION VALIDITY] No AST reference for segment at line', seg.line);
                continue;
            }

            // Only process confident matches
            if (isConfidentMatch(locateResult, 0.5)) {
                console.log('[SECTION VALIDITY] Segment resolved successfully', {
                    originalLine: seg.line,
                    resolvedLines: locateResult.currentLines,
                    confidence: locateResult.confidence
                });

                // Build ranges for this segment
                const ranges = locateResult.currentRange
                    ? buildRangesFromASTResult(document, locateResult.currentRange)
                    : [];

                segmentResults.push({
                    segment: seg,
                    locateResult,
                    ranges
                });
            } else {
                console.warn('[SECTION VALIDITY] Segment resolution failed', {
                    line: seg.line,
                    confidence: locateResult.confidence,
                    error: locateResult.error
                });
            }
        }

        if (segmentResults.length === 0) {
            webviewContainer.webview.postMessage({
                command: 'sectionValidityResult',
                status: 'code_not_matched',
                details: 'No segments could be resolved'
            });
            return;
        }

        // Collect all ranges from all segments for selection
        const allRanges = segmentResults.flatMap(r => r.ranges);

        // Open file and navigate to first match, selecting all matched regions
        try {
            const editor = await vscode.window.showTextDocument(document, { preview: false });

            if (allRanges.length > 0) {
                // Create selection from first to last range
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
            }
        } catch (e) {
            // Ignore navigation errors, still report success
            console.warn('[SECTION VALIDITY] Navigation error:', e);
        }

        // Report success with per-segment details
        webviewContainer.webview.postMessage({
            command: 'sectionValidityResult',
            status: 'success',
            totalSegments: codeSegments.length,
            resolvedSegments: segmentResults.length,
            segmentDetails: segmentResults.map(r => ({
                originalLine: r.segment.line,
                resolvedLines: r.locateResult.currentLines,
                confidence: r.locateResult.confidence,
                method: r.locateResult.method
            }))
        });
    } catch (error) {
        console.error('[SECTION VALIDITY] Unexpected error:', error);
        webviewContainer.webview.postMessage({
            command: 'sectionValidityResult',
            status: 'code_not_matched',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
