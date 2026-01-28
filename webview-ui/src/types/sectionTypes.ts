// Types and utilities for section data and summaries

/**
 * Represents an anchor point in the AST for robust code location
 */
export interface ASTAnchor {
    nodeType: string;
    nodeName?: string;
    path: number[];
    pathTypes: string[];
    pathNames: string[];
    signature?: string;
    originalStartLine: number;
    originalEndLine: number;
    originalOffset: number;
    contentHash?: string;
}

/**
 * Reference to a specific AST node for code mapping
 */
export interface ASTNodeReference {
    anchor: ASTAnchor;
    originalLine: number;
    originalText: string;
}

/**
 * Represents the summary data for a code section.
 */
export type SummaryData = {
    title: string;
    // 6 combinations: [detail][structured]
    low_unstructured: string;
    low_structured: string;
    medium_unstructured: string;
    medium_structured: string;
    high_unstructured: string;
    high_structured: string;
};

/**
 * Represents a single code segment with optional AST reference.
 */
export interface CodeSegment {
    code: string;
    line: number;
    astNodeRef?: ASTNodeReference; // AST anchor for robust alignment
}

/**
 * Represents a mapping between a summary component and one or more code segments.
 * - summaryComponent: The phrase or component from the summary.
 * - codeSegments: An array of code fragments with their line numbers for precise mapping.
 */
export interface SummaryCodeMapping {
    summaryComponent: string;
    codeSegments: CodeSegment[];
}

export type DetailLevel = "low" | "medium" | "high";
export type StructuredType = "structured" | "unstructured";

/**
 * Metadata for a code section.
 * Groups all section-related identifiers and file info.
 */
export interface SectionMetadata {
    id: string;
    filename: string;
    fullPath: string;
    offset: number;
    originalCode: string;
    astAnchor?: ASTAnchor; // AST-based anchor for robust code location
    sessionCodeSegments?: CodeSegment[]; // AST-based segments covering the full session
}

/**
 * Data structure for a code section with its summary and state.
 */
export interface SectionData {
    metadata: SectionMetadata;
    lines: [number, number];
    title: string;
    createdAt: number;
    summaryData: SummaryData;
    oldSummaryData?: SummaryData;
    // Selection state
    selectedDetailLevel: DetailLevel;
    selectedStructured: StructuredType;
    editPromptDetailLevel: DetailLevel | null;
    editPromptStructured: StructuredType | null;
    editPromptValue: string;
    // 6-way mapping
    summaryMappings: {
        low_unstructured: SummaryCodeMapping[];
        low_structured: SummaryCodeMapping[];
        medium_unstructured: SummaryCodeMapping[];
        medium_structured: SummaryCodeMapping[];
        high_unstructured: SummaryCodeMapping[];
        high_structured: SummaryCodeMapping[];
    };
    // Code validity tracking
    isCodeValid?: boolean;
    validationError?: string;
    lastValidationTime?: number;
    // Available scopes list: from innermost (method/class) to outermost (file)
    availableScopes?: ScopeInfo[];
}

/**
 * Message from VSCode indicating summary progress.
 */
export interface SummaryProgressMessage {
    command: "summaryProgress";
    stageText?: string;
}

/**
 * Message from VSCode containing summary data.
 */
export interface SummaryResultMessage {
    command: "summaryResult";
    data?: SummaryData;
    filename?: string;
    fullPath?: string;
    lines?: string;
    title?: string;
    createdAt?: string;
    originalCode?: string;
    offset?: number;
    sectionId?: string; // Backend-generated section ID for file tracking
    astAnchor?: ASTAnchor; // AST anchor for robust code location
    sessionCodeSegments?: CodeSegment[]; // AST-based segments covering the full session
    summaryMappings?: {
        low_unstructured: SummaryCodeMapping[];
        low_structured: SummaryCodeMapping[];
        medium_unstructured: SummaryCodeMapping[];
        medium_structured: SummaryCodeMapping[];
        high_unstructured: SummaryCodeMapping[];
        high_structured: SummaryCodeMapping[];
    };
    error?: string;
    oldSummaryData?: SummaryData; // Optional: previous summary for diff rendering
}

/**
 * Message from VSCode indicating an edit result.
 */
export interface EditResultMessage {
    command: "editResult";
    action: string;
    sectionId: string;
    newCode: string;
}

/**
 * Message from VSCode indicating section validity status.
 */
export interface SectionValidityBatchMessage {
    command: "sectionValidityBatch";
    results: Array<{
        sectionId: string;
        isCodeValid: boolean;
        validationError?: string;
    }>;
}

/**
 * Message from VSCode containing extracted section code.
 */
export interface ExtractedSectionCodeMessage {
    command: "extractedSectionCode";
    sectionId: string;
    newCode?: string;
    segmentCount?: number;
    error?: string;
}
/**
 * Represents an available code scope (File/Class/Method)
 * Uses AST path for robust code location, not line/column
 */
export interface ScopeInfo {
    type: 'file' | 'class' | 'method';
    name?: string;
    /**
     * AST path for robust scope relocation across code edits
     * Path format: Array of { type: string; name?: string; index?: number }
     * This allows backend to relocate scope even if line numbers change
     */
    path?: Array<{ type: string; name?: string; index?: number }>;
}

/**
 * Message from VSCode containing available scopes for a section
 */
export interface AvailableScopesMessage {
    command: "availableScopes";
    sectionId: string;
    scopes: ScopeInfo[];  // List of scopes from innermost to outermost
    error?: string;
}