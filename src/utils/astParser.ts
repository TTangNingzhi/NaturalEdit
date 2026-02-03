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
