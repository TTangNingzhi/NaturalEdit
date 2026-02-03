/**
 * Type definitions for AST-based alignment system
 */

/**
 * Represents an anchor point in the AST for robust code location
 * 
 * Design (v2):
 * - path/pathTypes/pathNames: ALWAYS describe the path from root to MINIMAL NODE
 * - minimalNodeType: Type of the actual smallest node that LLM matched to
 * - minimalNodeName: Name of the minimal node (if available)
 * - meaningfulNodeType/Name/signature: OPTIONAL semantic information from a meaningful ancestor
 */
export interface ASTAnchor {
    /**
     * Type of the MINIMAL (smallest) AST node that LLM matched to
     * This is what the path points to
     */
    minimalNodeType: string;

    /**
     * Name/identifier of the minimal node (optional, may not exist for all node types)
     */
    minimalNodeName?: string;

    /**
     * Path from root to the MINIMAL NODE as array of child indices
     * This is the complete, unmodified path - not filtered by any semantic criteria
     */
    path: number[];

    /**
     * Array of node types along the path to MINIMAL NODE (for validation)
     */
    pathTypes: string[];

    /**
     * Array of node names along the path to MINIMAL NODE (for validation)
     */
    pathNames: string[];

    /** Starting line number (1-based) at time of anchor creation */
    originalStartLine: number;

    /** Ending line number (1-based) at time of anchor creation */
    originalEndLine: number;

    /** Character offset in file at time of anchor creation */
    originalOffset: number;

    /** Hash of the minimal node text for quick staleness check */
    contentHash?: string;
}

/**
 * Result of attempting to locate code using AST anchor
 */
export interface ASTLocateResult {
    /** Whether the code was successfully located */
    found: boolean;

    /** Current line range if found (1-based line numbers) */
    currentLines?: [number, number];

    /** Current position range if found (1-based line, 0-based column) */
    currentRange?: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };

    /** Updated code text if found */
    currentCode?: string;

    /** Method used to locate: 'ast-path' or 'not-found' */
    method: 'ast-path' | 'not-found';

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

    /** Original line number when mapping was created (1-based, for logging/debugging) */
    originalLine: number;

    /** FULL text of the minimal AST node (not LLM fragment) */
    originalText: string;

    /** Optional: The partial text fragment that LLM actually output (for debugging) */
    llmFragment?: string;
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
