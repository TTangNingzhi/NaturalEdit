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

        console.log(`[findMinimalContainingNode] Found minimal node for fragment "${textFragment.substring(0, 30)}..." at line ${line}:`, {
            type: minimalNode.type,
            name: this.extractNodeName(minimalNode),
            startLine: minimalNode.startPosition.row + 1,
            endLine: minimalNode.endPosition.row + 1,
            textLength: (minimalNode.text || '').length,
            textPreview: (minimalNode.text || '').substring(0, 80) + '...',
            candidateCount: candidateNodes.length,
            allTypes: candidateNodes.slice(0, 5).map(n => ({ type: n.type, len: n.text.length }))
        });

        return minimalNode;
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
     * Find node by path
     */
    public findNodeByPath(tree: any, nodePath: NodePath): any | null {
        let current: any = tree.rootNode;

        for (let i = 0; i < nodePath.indices.length; i++) {
            const index = nodePath.indices[i];
            const expectedType = nodePath.types[i];

            if (index < 0 || index >= current.children.length) {
                return null;
            }

            const child = current.children[index];

            if (!child) {
                return null;
            }

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
