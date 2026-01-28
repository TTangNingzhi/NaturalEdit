import Parser from 'web-tree-sitter';
import * as path from 'path';

/**
 * Supported languages for AST parsing
 */
export enum Language {
    TypeScript = 'typescript',
    JavaScript = 'javascript',
    Python = 'python',
    TSX = 'tsx',
    JSX = 'javascript',
    Rust = 'rust',
    Go = 'go',
    Cpp = 'cpp',
    C = 'c',
    CSharp = 'c_sharp',
    Ruby = 'ruby',
    Java = 'java',
    Php = 'php',
    Swift = 'swift',
    Kotlin = 'kotlin',
}

/**
 * Represents a node in the AST with structural information
 */
export interface ASTNode {
    type: string;
    name?: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    text: string;
    children: ASTNode[];
}

/**
 * Represents a path to a node in the AST tree
 */
export interface NodePath {
    indices: number[];  // Path as child indices from root
    types: string[];    // Node types along the path
    names: string[];    // Node names (identifiers) along the path
}

/**
 * AST Parser wrapper using tree-sitter for robust code analysis
 */
export class ASTParser {
    private static instance: ASTParser | null = null;
    private parser: Parser | null = null;
    private languages: Map<Language, Parser.Language> = new Map();
    private initialized: boolean = false;

    private constructor() { }

    /**
     * Get singleton instance of AST parser
     */
    public static getInstance(): ASTParser {
        if (!ASTParser.instance) {
            ASTParser.instance = new ASTParser();
        }
        return ASTParser.instance;
    }

    /**
     * Initialize the parser and load language grammars
     */
    public async initialize(wasmPath?: string): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Initialize Parser (simple init for Node.js)
            await Parser.init();

            // Create parser instance
            this.parser = new Parser();

            // Determine WASM path - use __dirname if in bundled extension, otherwise use provided path
            const basePath = wasmPath || __dirname;

            // Load language grammars
            await this.loadLanguage(Language.TypeScript, 'tree-sitter-typescript.wasm', basePath);
            await this.loadLanguage(Language.JavaScript, 'tree-sitter-javascript.wasm', basePath);
            await this.loadLanguage(Language.Python, 'tree-sitter-python.wasm', basePath);
            await this.loadLanguage(Language.TSX, 'tree-sitter-tsx.wasm', basePath);
            await this.loadLanguage(Language.Rust, 'tree-sitter-rust.wasm', basePath);
            await this.loadLanguage(Language.Go, 'tree-sitter-go.wasm', basePath);
            await this.loadLanguage(Language.Cpp, 'tree-sitter-cpp.wasm', basePath);
            await this.loadLanguage(Language.C, 'tree-sitter-c.wasm', basePath);
            await this.loadLanguage(Language.CSharp, 'tree-sitter-c_sharp.wasm', basePath);
            await this.loadLanguage(Language.Ruby, 'tree-sitter-ruby.wasm', basePath);
            await this.loadLanguage(Language.Java, 'tree-sitter-java.wasm', basePath);
            await this.loadLanguage(Language.Php, 'tree-sitter-php.wasm', basePath);
            await this.loadLanguage(Language.Swift, 'tree-sitter-swift.wasm', basePath);
            await this.loadLanguage(Language.Kotlin, 'tree-sitter-kotlin.wasm', basePath);

            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize AST parser:', error);
            throw error;
        }
    }

    /**
     * Load a specific language grammar
     */
    private async loadLanguage(language: Language, wasmFile: string, basePath: string): Promise<void> {
        try {
            const modulePath = path.join(basePath, wasmFile);
            const langObj = await Parser.Language.load(modulePath);
            this.languages.set(language, langObj);
            console.log(`✓ Successfully loaded language: ${language}`);
        } catch (error) {
            console.error(`✗ Failed to load language ${language}:`, error);
        }
    }

    /**
     * Detect language from file extension
     */
    private detectLanguage(filePath: string): Language | null {
        const ext = path.extname(filePath).toLowerCase();

        switch (ext) {
            case '.js':
            case '.jsx':
                return Language.JavaScript;
            case '.ts':
                return Language.TypeScript;
            case '.tsx':
                return Language.TSX;
            case '.py':
                return Language.Python;
            case '.rs':
                return Language.Rust;
            case '.go':
                return Language.Go;
            case '.cpp':
            case '.hpp':
                return Language.Cpp;
            case '.c':
            case '.h':
                return Language.C;
            case '.cs':
                return Language.CSharp;
            case '.rb':
                return Language.Ruby;
            case '.java':
                return Language.Java;
            case '.php':
                return Language.Php;
            case '.swift':
                return Language.Swift;
            case '.kt':
                return Language.Kotlin;
            default:
                return null;
        }
    }

    /**
     * Check whether a file path is supported and a grammar is loaded
     */
    public isLanguageSupported(filePath: string): boolean {
        const language = this.detectLanguage(filePath);
        if (!language) {
            return false;
        }
        return this.languages.has(language);
    }

    /**
     * Parse source code and return the AST tree
     */
    public parse(code: string, filePath: string): any | null {
        if (!this.initialized || !this.parser) {
            console.error('Parser not initialized. Call initialize() first.');
            return null;
        }

        const language = this.detectLanguage(filePath);
        if (!language) {
            console.warn(`Unsupported file type: ${filePath}`);
            return null;
        }

        const langObj = this.languages.get(language);
        if (!langObj) {
            console.warn(`Language grammar not loaded: ${language}`);
            return null;
        }

        this.parser.setLanguage(langObj);
        return this.parser.parse(code);
    }

    /**
     * Convert tree-sitter node to simplified ASTNode
     */
    private convertNode(node: any): ASTNode {
        if (!node) {
            return {
                type: 'unknown',
                startPosition: { row: 0, column: 0 },
                endPosition: { row: 0, column: 0 },
                text: '',
                children: []
            };
        }

        return {
            type: node.type,
            name: this.extractNodeName(node),
            startPosition: node.startPosition,
            endPosition: node.endPosition,
            text: node.text,
            children: node.children?.map((child: any) => this.convertNode(child)) || []
        };
    }

    /**
     * Extract the name/identifier from a node if available
     */
    private extractNodeName(node: any): string | undefined {
        // Special handling for different node types

        // For method_declaration and method_definition (Java, Python, etc.)
        if (node.type === 'method_declaration' || node.type === 'method_definition') {
            // Look for the 'name' child first (most reliable)
            const nameChild = node.children.find((child: any) => child.type === 'identifier' && child !== node.children[0]);
            if (nameChild) {
                return nameChild.text;
            }
            // Fallback: find identifier that's not the first one (to skip return type)
            let foundReturnType = false;
            for (const child of node.children) {
                if (child.type === 'identifier' || child.type === 'property_identifier' || child.type === 'type_identifier') {
                    if (!foundReturnType) {
                        foundReturnType = true;
                        continue;  // Skip first identifier (return type)
                    }
                    return child.text;  // Return second identifier (method name)
                }
            }
        }

        // For function_declaration (JavaScript, TypeScript, etc.)
        if (node.type === 'function_declaration' || node.type === 'function_definition') {
            const nameChild = node.children.find((child: any) => child.type === 'identifier');
            if (nameChild) {
                return nameChild.text;
            }
        }

        // For class_declaration (Java, TypeScript, etc.)
        if (node.type === 'class_declaration' || node.type === 'class_definition') {
            const nameChild = node.children.find((child: any) => child.type === 'identifier' || child.type === 'type_identifier');
            if (nameChild) {
                return nameChild.text;
            }
        }

        // Generic fallback: find first identifier
        const identifierChild = node.children.find((child: any) =>
            child.type === 'identifier' ||
            child.type === 'property_identifier' ||
            child.type === 'type_identifier'
        );

        if (identifierChild) {
            return identifierChild.text;
        }

        // For nodes that ARE identifiers
        if (node.type === 'identifier' || node.type === 'property_identifier') {
            return node.text;
        }

        return undefined;
    }

    /**
     * Find node at specific line and column
     */
    public findNodeAtPosition(
        tree: any,
        line: number,
        column: number
    ): any | null {
        const point = { row: line, column };
        return tree.rootNode.descendantForPosition(point);
    }

    /**
     * Find the minimal (smallest) AST node that contains the given text fragment at the specified line.
     * 
     * NEW LOGIC (v3):
     * - Search across ALL column positions on the target line
     * - Collect ALL nodes (at any depth) that contain the fragment
     * - Return the SMALLEST one by text length
     * - This ensures we find statement-level nodes, not just function/class containers
     * 
     * @param tree The parsed syntax tree
     * @param line The 1-based line number from LLM output
     * @param textFragment The partial text snippet from LLM (can be incomplete)
     * @returns The smallest AST node containing the text, or null if not found
     */
    public findMinimalContainingNode(
        tree: any,
        line: number,
        textFragment: string
    ): any | null {
        if (!tree || !tree.rootNode) {
            return null;
        }

        // Normalize the text fragment for comparison (trim whitespace)
        const normalizedFragment = textFragment.trim();
        if (normalizedFragment.length === 0) {
            return null;
        }

        // Collect ALL nodes from various positions on the line
        const candidateNodesMap = new Map<string, any>(); // Use map to avoid duplicates

        // Try every column position from 0 to 300 (covering deep indentation)
        for (let col = 0; col < 300; col++) {
            const point = { row: line - 1, column: col };
            const nodeAtPosition = tree.rootNode.descendantForPosition(point);

            if (!nodeAtPosition) { continue; }

            // Check this node and ALL its ancestors
            let ancestor = nodeAtPosition;
            while (ancestor) {
                const nodeText = ancestor.text || '';

                // Skip error nodes
                if (ancestor.type === 'ERROR' || ancestor.hasError) {
                    ancestor = ancestor.parent;
                    continue;
                }

                // Normalize and check if contains fragment
                const normalizedNodeText = nodeText.replace(/\s+/g, ' ').trim();
                const normalizedFragmentForSearch = normalizedFragment.replace(/\s+/g, ' ').trim();

                if (normalizedNodeText.includes(normalizedFragmentForSearch)) {
                    // Use node ID to avoid duplicates
                    const nodeId = `${ancestor.type}-${ancestor.startPosition.row}-${ancestor.startPosition.column}-${ancestor.endPosition.row}-${ancestor.endPosition.column}`;
                    if (!candidateNodesMap.has(nodeId)) {
                        candidateNodesMap.set(nodeId, ancestor);
                    }
                }

                ancestor = ancestor.parent;
            }
        }

        const candidateNodes = Array.from(candidateNodesMap.values());

        if (candidateNodes.length === 0) {
            console.warn(`[findMinimalContainingNode] No node found containing fragment: "${textFragment}" at line ${line}`);
            return null;
        }

        // Sort by text length (shortest = smallest = minimal)
        candidateNodes.sort((a, b) => {
            const aLen = (a.text || '').length;
            const bLen = (b.text || '').length;
            return aLen - bLen;
        });

        const minimalNode = candidateNodes[0];
        return minimalNode;
    }

    /**
     * Get the path from root to a specific node
     */
    public getNodePath(node: any): NodePath {
        const indices: number[] = [];
        const types: string[] = [];
        const names: string[] = [];

        let current: any | null = node;

        while (current && current.parent) {
            const parent = current.parent;

            // Find index by iterating through parent's children
            let index = -1;
            const currentId = current.id;
            for (let i = 0; i < parent.children.length; i++) {
                if (parent.children[i].id === currentId) {
                    index = i;
                    break;
                }
            }

            indices.unshift(index);
            types.unshift(current.type);

            const name = this.extractNodeName(current);
            names.unshift(name || '');

            current = parent;
        }

        return { indices, types, names };
    }

    /**
     * Find node by path with flexible matching
     * Priority: type > name > position
     * If exact path doesn't work, tries to find best match at each level
     * 
     * @returns {node, confidence} where confidence indicates match quality
     */
    public findNodeByPathFlexible(tree: any, nodePath: NodePath): { node: any; confidence: number } | null {
        let current: any = tree.rootNode;
        let totalConfidence = 1.0;
        const pathLength = nodePath.indices.length;

        for (let i = 0; i < pathLength; i++) {
            const expectedIndex = nodePath.indices[i];
            const expectedType = nodePath.types[i];
            const expectedName = nodePath.names[i];

            // Try exact match first (type + name + position)
            if (expectedIndex >= 0 && expectedIndex < current.children.length) {
                const exactChild = current.children[expectedIndex];
                if (exactChild && exactChild.type === expectedType) {
                    const exactName = this.extractNodeName(exactChild);
                    if (!expectedName || exactName === expectedName) {
                        // Perfect match at this level
                        current = exactChild;
                        continue;
                    }
                }
            }

            // Exact match failed, find best alternative among siblings
            // Priority: type + name > type + position > type only
            let bestMatch: any = null;
            let bestScore = 0;
            let matchMethod = '';

            for (let j = 0; j < current.children.length; j++) {
                const candidate = current.children[j];
                if (!candidate) { continue; }

                let score = 0;
                let method = '';

                // Check type match (highest priority)
                if (candidate.type === expectedType) {
                    score += 0.5; // Base score for type match
                    method = 'type';

                    // Check name match (second priority)
                    const candidateName = this.extractNodeName(candidate);
                    if (expectedName && candidateName === expectedName) {
                        score += 0.4; // type + name = 0.9
                        method = 'type+name';
                    }

                    // Check position proximity (lowest priority)
                    if (j === expectedIndex) {
                        score += 0.1; // exact position bonus
                        method = method === 'type+name' ? 'type+name+pos' : 'type+pos';
                    } else {
                        // Slight bonus for being close to expected position
                        const distance = Math.abs(j - expectedIndex);
                        const proximityBonus = Math.max(0, 0.05 * (1 - distance / current.children.length));
                        score += proximityBonus;
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = candidate;
                        matchMethod = method;
                    }
                }
            }

            if (!bestMatch) {
                // No matching type found at this level, path is broken
                console.warn(`  [findNodeByPathFlexible] Failed at level ${i}: no node with type "${expectedType}" found`);
                return null;
            }

            // Apply confidence penalty based on match quality
            if (matchMethod === 'type+name+pos') {
                // Perfect match, no penalty
                totalConfidence *= 1.0;
            } else if (matchMethod === 'type+name') {
                // Good match (type + name), slight penalty for wrong position
                totalConfidence *= 0.95;
            } else if (matchMethod === 'type+pos') {
                // OK match (type + position), penalty for wrong name
                totalConfidence *= 0.85;
            } else {
                // Weak match (type only)
                totalConfidence *= 0.75;
            }
            current = bestMatch;
        }

        return { node: current, confidence: totalConfidence };
    }

    /**
     * Check if parser is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Find the parent scopes (File/Class/Method) that contain the selection
     * Traverses from bottom to top (innermost to outermost) in the AST
     * Returns a single list with all scopes in order (innermost first), each with a type attribute
     * 
     * @param tree The AST tree
     * @param startLine 0-based line number
     * @param startColumn 0-based column number
     * @param endLine 0-based line number
     * @param endColumn 0-based column number
     */
    public findEnclosingScopes(
        tree: Parser.Tree,
        startLine: number,
        startColumn: number,
        endLine: number,
        endColumn: number
    ): {
        scopes?: Array<{ type: 'method' | 'class' | 'file'; name?: string; path?: NodePath }>;
    } {
        const result: {
            scopes?: Array<{ type: 'method' | 'class' | 'file'; name?: string; path?: NodePath }>;
        } = {};

        // Find node at the start of selection
        const node = tree.rootNode.descendantForPosition({ row: startLine, column: startColumn });
        if (!node) {
            // Return file scope only
            result.scopes = [{ type: 'file' }];
            return result;
        }

        // Traverse from current node to root, collecting all scopes
        const scopes: Array<{ type: 'method' | 'class' | 'file'; name?: string; path?: NodePath }> = [];
        let current: any = node;

        while (current) {
            const nodeType = current.type;

            // Check if this is a method/function
            if (current.type.includes('function') ||
                current.type.includes('method') ||
                current.type === 'function_declaration' ||
                current.type === 'function_definition' ||
                current.type === 'method_declaration' ||
                current.type === 'method_definition'
            ) {
                const methodName = this.extractNodeName(current);
                if (methodName) {
                    const methodPath = this.getNodePath(current);
                    scopes.push({
                        type: 'method',
                        name: methodName,
                        path: methodPath
                    });
                }
            }
            // Check if this is a class
            else if (nodeType === 'class_declaration' ||
                nodeType === 'class_definition' ||
                nodeType === 'enum_declaration' ||
                nodeType === 'interface_declaration' ||
                (nodeType.includes('class') && (nodeType.includes('declaration') || nodeType.includes('definition')))
            ) {
                const className = this.extractNodeName(current);
                if (className) {
                    const classPath = this.getNodePath(current);
                    scopes.push({
                        type: 'class',
                        name: className,
                        path: classPath
                    });
                }
            }

            current = current.parent;
        }

        // Always add file scope at the end (outermost)
        scopes.push({ type: 'file' });

        result.scopes = scopes;
        return result;
    }
}
