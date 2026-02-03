/**
 * Type definitions for AST-based alignment system
 */

/**
 * Represents an anchor point in the AST for robust code location
 */
export interface ASTAnchor {
    /** Type of the AST node (e.g., 'function_declaration', 'class_declaration') */
    nodeType: string;

    /** Name/identifier of the node (e.g., function name, class name) */
    nodeName?: string;

    /** Path from root to this node as array of child indices */
    path: number[];

    /** Array of node types along the path for validation */
    pathTypes: string[];

    /** Array of node names along the path for additional validation */
    pathNames: string[];

    /** Function/method signature for additional matching */
    signature?: string;

    /** Starting line number (1-based) at time of anchor creation */
    originalStartLine: number;

    /** Ending line number (1-based) at time of anchor creation */
    originalEndLine: number;

    /** Character offset in file at time of anchor creation */
    originalOffset: number;

    /** Hash of the node text for quick staleness check */
    contentHash?: string;
}

/**
 * Result of attempting to locate code using AST anchor
 */
export interface ASTLocateResult {
    /** Whether the code was successfully located */
    found: boolean;

    /** Current line range if found */
    currentLines?: [number, number];

    /** Updated code text if found */
    currentCode?: string;

    /** Method used to locate: 'ast-path', 'ast-signature', 'ast-fuzzy', 'text-fallback' */
    method: 'ast-path' | 'ast-signature' | 'ast-fuzzy' | 'text-fallback' | 'not-found';

    /** Confidence score 0-1 */
    confidence: number;

    /** Error message if location failed */
    error?: string;
}

/**
 * Reference to a specific AST node for code mapping
 */
export interface ASTNodeReference {
    /** AST anchor for the node */
    anchor: ASTAnchor;

    /** Original line number when mapping was created (1-based) */
    originalLine: number;

    /** Original code text */
    originalText: string;
}

/**
 * Configuration for AST parser
 */
export interface ASTParserConfig {
    /** Path to WASM files */
    wasmPath?: string;

    /** Supported languages */
    languages?: string[];

    /** Enable caching of parsed trees */
    enableCache?: boolean;

    /** Maximum cache size (number of files) */
    maxCacheSize?: number;
}

/**
 * Statistics about AST alignment operations
 */
export interface ASTAlignmentStats {
    /** Total alignment attempts */
    totalAttempts: number;

    /** Successful alignments via AST path */
    pathSuccesses: number;

    /** Successful alignments via signature matching */
    signatureSuccesses: number;

    /** Successful alignments via fuzzy AST matching */
    fuzzySuccesses: number;

    /** Fallbacks to text-based matching */
    textFallbacks: number;

    /** Failed alignments */
    failures: number;

    /** Average confidence score */
    averageConfidence: number;
}
