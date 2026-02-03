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
    JSX = 'jsx',
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
            console.log(`Loading language ${language} from ${modulePath}`);

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
            case '.ts':
                return Language.TypeScript;
            case '.tsx':
                return Language.TSX;
            case '.js':
            case '.mjs':
            case '.cjs':
                return Language.JavaScript;
            case '.jsx':
                return Language.JSX;
            case '.py':
                return Language.Python;
            default:
                return null;
        }
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
        // Try to find identifier child
        const identifierChild = node.children.find((child: any) =>
            child.type === 'identifier' ||
            child.type === 'property_identifier' ||
            child.type === 'type_identifier'
        );

        if (identifierChild) {
            return identifierChild.text;
        }

        // For some nodes, the name is directly in the node
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
     * This is used to transform LLM's partial line-based output into complete AST node references.
     * Prioritizes statement-level nodes over function/class-level nodes.
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

        // Get all nodes that overlap with the target line (convert to 0-based)
        const lineStartPoint = { row: line - 1, column: 0 };

        // Start with node at beginning of line
        let currentNode = tree.rootNode.descendantForPosition(lineStartPoint);
        if (!currentNode) {
            return null;
        }

        // Collect all ancestor nodes that could contain the fragment
        const candidateNodes: any[] = [];
        let node = currentNode;

        while (node) {
            // Check if this node's text contains the fragment
            const nodeText = node.text || '';
            const normalizedNodeText = nodeText.replace(/\s+/g, ' ').trim();
            const normalizedFragmentForSearch = normalizedFragment.replace(/\s+/g, ' ').trim();

            if (normalizedNodeText.includes(normalizedFragmentForSearch)) {
                candidateNodes.push(node);
            }

            node = node.parent;
        }

        // If no candidates found, try searching from different positions on the same line
        if (candidateNodes.length === 0) {
            // Try multiple column positions on the line
            for (let col = 0; col < 200; col += 10) {
                const point = { row: line - 1, column: col };
                const testNode = tree.rootNode.descendantForPosition(point);

                if (testNode) {
                    let ancestor = testNode;
                    while (ancestor) {
                        const nodeText = ancestor.text || '';
                        const normalizedNodeText = nodeText.replace(/\s+/g, ' ').trim();
                        const normalizedFragmentForSearch = normalizedFragment.replace(/\s+/g, ' ').trim();

                        if (normalizedNodeText.includes(normalizedFragmentForSearch)) {
                            candidateNodes.push(ancestor);
                            break;
                        }
                        ancestor = ancestor.parent;
                    }
                }

                if (candidateNodes.length > 0) {
                    break;
                }
            }
        }

        if (candidateNodes.length === 0) {
            console.warn(`[findMinimalContainingNode] No node found containing fragment: "${textFragment}" at line ${line}`);
            return null;
        }

        // Define node type priorities (lower number = higher priority)
        // Prioritize statement-level nodes over container nodes
        const getNodePriority = (nodeType: string): number => {
            // Top priority: Specific statements that are complete semantic units
            const statementTypes = new Set([
                'assignment_statement',
                'expression_statement',
                'return_statement',
                'import_statement',
                'if_statement',
                'for_statement',
                'while_statement',
                'with_statement',
                'raise_statement',
                'assert_statement',
                'delete_statement',
                'pass_statement',
                'break_statement',
                'continue_statement',
                // TypeScript/JavaScript statements
                'variable_declaration',
                'lexical_declaration',
                'const_declaration',
                'let_declaration',
                'if_statement',
                'for_statement',
                'while_statement',
                'do_statement',
                'switch_statement',
                'try_statement',
                'throw_statement'
            ]);

            if (statementTypes.has(nodeType)) {
                return 1; // Highest priority
            }

            // Medium priority: Expressions and smaller constructs
            const expressionTypes = new Set([
                'call_expression',
                'assignment_expression',
                'binary_expression',
                'list_comprehension',
                'dictionary_comprehension',
                'lambda',
                'arrow_function'
            ]);

            if (expressionTypes.has(nodeType)) {
                return 2;
            }

            // Lower priority: Container/structural nodes (functions, classes)
            const containerTypes = new Set([
                'function_definition',
                'function_declaration',
                'method_definition',
                'class_definition',
                'class_declaration'
            ]);

            if (containerTypes.has(nodeType)) {
                return 4; // Lower priority - avoid selecting entire functions
            }

            // Lowest priority: Very generic nodes
            const genericTypes = new Set([
                'program',
                'module',
                'block',
                'statement_block',
                'body'
            ]);

            if (genericTypes.has(nodeType)) {
                return 5; // Lowest priority
            }

            return 3; // Default priority for other nodes
        };

        // Sort candidates by:
        // 1. Priority (statement-level > expression > container > generic)
        // 2. Text length (smaller is better within same priority)
        candidateNodes.sort((a, b) => {
            const priorityA = getNodePriority(a.type);
            const priorityB = getNodePriority(b.type);

            if (priorityA !== priorityB) {
                return priorityA - priorityB; // Lower number = higher priority = comes first
            }

            // Same priority, prefer smaller node
            const aLen = (a.text || '').length;
            const bLen = (b.text || '').length;
            return aLen - bLen;
        });

        const minimalNode = candidateNodes[0];

        // If we found a large container node (function/class), try to find child statements instead
        const isLargeContainer = getNodePriority(minimalNode.type) >= 4; // Container or generic nodes
        const nodeSpan = minimalNode.endPosition.row - minimalNode.startPosition.row + 1;

        if (isLargeContainer && nodeSpan > 3) {
            // Try to find child statement nodes that contain the fragment
            const childStatements = this.findChildStatements(minimalNode, normalizedFragment);

            if (childStatements.length > 0) {
                console.log(`[findMinimalContainingNode] Large container detected (${minimalNode.type}, ${nodeSpan} lines). Found ${childStatements.length} child statement(s) containing fragment.`);

                // Return the first (smallest) child statement that contains the fragment
                const bestChild = childStatements[0];
                console.log(`[findMinimalContainingNode] Using child statement instead:`, {
                    type: bestChild.type,
                    priority: getNodePriority(bestChild.type),
                    name: this.extractNodeName(bestChild),
                    startLine: bestChild.startPosition.row + 1,
                    endLine: bestChild.endPosition.row + 1,
                    textPreview: (bestChild.text || '').substring(0, 80) + '...'
                });
                return bestChild;
            }
        }

        console.log(`[findMinimalContainingNode] Found minimal node for fragment "${textFragment.substring(0, 30)}..." at line ${line}:`, {
            type: minimalNode.type,
            priority: getNodePriority(minimalNode.type),
            name: this.extractNodeName(minimalNode),
            startLine: minimalNode.startPosition.row + 1,
            endLine: minimalNode.endPosition.row + 1,
            textLength: (minimalNode.text || '').length,
            textPreview: (minimalNode.text || '').substring(0, 80) + '...'
        });

        return minimalNode;
    }

    /**
     * Find child statement nodes within a parent node that contain the given fragment.
     * Used to extract specific statements from large container nodes (functions, classes).
     */
    private findChildStatements(parentNode: any, normalizedFragment: string): any[] {
        if (!parentNode || !parentNode.children) {
            return [];
        }

        const statementTypes = new Set([
            'assignment_statement',
            'expression_statement',
            'return_statement',
            'import_statement',
            'if_statement',
            'for_statement',
            'while_statement',
            'with_statement',
            'raise_statement',
            'assert_statement',
            'variable_declaration',
            'lexical_declaration',
            'const_declaration',
            'let_declaration'
        ]);

        const matchingStatements: any[] = [];

        const traverse = (node: any) => {
            // Check if this is a statement node
            if (statementTypes.has(node.type)) {
                const nodeText = (node.text || '').replace(/\s+/g, ' ').trim();
                if (nodeText.includes(normalizedFragment)) {
                    matchingStatements.push(node);
                    return; // Don't traverse children of matching statement
                }
            }

            // Recursively check children
            if (node.children) {
                for (const child of node.children) {
                    traverse(child);
                }
            }
        };

        traverse(parentNode);

        // Sort by text length (prefer smaller, more specific statements)
        matchingStatements.sort((a, b) => {
            const aLen = (a.text || '').length;
            const bLen = (b.text || '').length;
            return aLen - bLen;
        });

        return matchingStatements;
    }

    /**
     * Find all nodes of a specific type
     */
    public findNodesByType(tree: any, type: string): any[] {
        const results: any[] = [];

        const traverse = (node: any) => {
            if (node.type === type) {
                results.push(node);
            }
            for (const child of node.children) {
                traverse(child);
            }
        };

        traverse(tree.rootNode);
        return results;
    }

    /**
     * Find function/method declaration by name
     */
    public findFunctionByName(tree: any, functionName: string): any | null {
        const functionTypes = [
            'function_declaration',
            'method_definition',
            'function_expression',
            'arrow_function',
            'function_definition'  // Python
        ];

        for (const funcType of functionTypes) {
            const functions = this.findNodesByType(tree, funcType);
            for (const func of functions) {
                const name = this.extractNodeName(func);
                if (name === functionName) {
                    return func;
                }
            }
        }

        return null;
    }

    /**
     * Find class declaration by name
     */
    public findClassByName(tree: any, className: string): any | null {
        const classes = this.findNodesByType(tree, 'class_declaration');

        for (const cls of classes) {
            const name = this.extractNodeName(cls);
            if (name === className) {
                return cls;
            }
        }

        return null;
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
            const index = parent.children.indexOf(current);

            indices.unshift(index);
            types.unshift(current.type);

            const name = this.extractNodeName(current);
            names.unshift(name || '');

            current = parent;
        }

        return { indices, types, names };
    }

    /**
     * Find node by path
     */
    public findNodeByPath(tree: any, nodePath: NodePath): any | null {
        let current: any = tree.rootNode;

        for (let i = 0; i < nodePath.indices.length; i++) {
            const index = nodePath.indices[i];
            const expectedType = nodePath.types[i];

            if (index >= current.children.length) {
                return null;
            }

            const child = current.children[index];

            // Check if child exists
            if (!child) {
                return null;
            }

            // Verify type matches
            if (child.type !== expectedType) {
                return null;
            }

            current = child;
        }

        return current;
    }

    /**
     * Get function signature for a function node
     */
    public getFunctionSignature(node: any): string | null {
        if (!node || !node.type) {
            return null;
        }

        if (!node.type.includes('function') && !node.type.includes('method')) {
            return null;
        }

        const name = this.extractNodeName(node);

        // Try to extract parameters
        const paramsNode = node.children.find((child: any) =>
            child.type === 'formal_parameters' ||
            child.type === 'parameters'
        );

        if (name && paramsNode) {
            return `${name}${paramsNode.text}`;
        }

        return name ?? null;
    }

    /**
     * Check if parser is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }
}
