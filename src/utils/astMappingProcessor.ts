import * as vscode from 'vscode';
import { ASTParser } from './astParser';
import { ASTCodeLocator } from './astCodeLocator';
import { ASTAnchor, ASTNodeReference } from '../types/astTypes';

/**
 * Post-processes LLM-generated mappings to add AST node references
 */
export class ASTMappingProcessor {
    private parser: ASTParser;
    private locator: ASTCodeLocator;

    constructor() {
        this.parser = ASTParser.getInstance();
        this.locator = new ASTCodeLocator();
    }

    /**
     * Convert LLM mappings with line numbers into AST-aware mappings
     * @param mappings Original LLM-generated mappings with line numbers
     * @param filePath Path to the source file
     * @param fullCode Complete code content of the file
     * @returns Mappings enhanced with AST node references
     */
    public async processMappings(
        mappings: Array<{
            summaryComponent: string;
            codeSegments: Array<{ code: string; line: number }>;
        }>,
        filePath: string,
        fullCode: string
    ): Promise<Array<{
        summaryComponent: string;
        codeSegments: Array<{
            code: string;
            line: number;
            astNodeRef?: ASTNodeReference;
        }>;
    }>> {
        // Parse the file
        const tree = this.parser.parse(fullCode, filePath);
        if (!tree) {
            console.warn('Failed to parse file for mapping processing:', filePath);
            return mappings;
        }

        // Process each mapping
        const enhancedMappings = await Promise.all(
            mappings.map(async (mapping) => {
                const enhancedSegments = await Promise.all(
                    mapping.codeSegments.map(async (segment) => {
                        const astNodeRef = await this.createNodeReference(
                            tree,
                            segment.code,
                            segment.line,
                            fullCode,
                            filePath
                        );

                        return {
                            ...segment,
                            astNodeRef
                        };
                    })
                );

                return {
                    summaryComponent: mapping.summaryComponent,
                    codeSegments: enhancedSegments
                };
            })
        );

        return enhancedMappings;
    }

    /**
     * Create an AST node reference for a code segment.
     * Transforms LLM's partial line-based output into a reference to the minimal complete AST node.
     */
    private async createNodeReference(
        tree: any,
        code: string,
        line: number,
        fullCode: string,
        filePath: string
    ): Promise<ASTNodeReference | undefined> {
        try {
            console.log(`[AST TRANSFORM] Processing LLM fragment: "${code.substring(0, 50)}..." at line ${line}`);

            // NEW APPROACH: Find the minimal AST node that contains the LLM's text fragment
            let minimalNode = this.parser.findMinimalContainingNode(tree, line, code);

            // Fallback: If minimal node not found, use old position-based method
            if (!minimalNode) {
                console.warn(`[AST TRANSFORM] Minimal node not found, falling back to position-based search`);
                const node = this.parser.findNodeAtPosition(tree, line - 1, 0);
                if (!node) {
                    return undefined;
                }
                minimalNode = this.findMeaningfulParent(node);
            }

            console.log(`[AST TRANSFORM] Found minimal node:`, {
                type: minimalNode.type,
                name: this.extractNodeName(minimalNode),
                startLine: minimalNode.startPosition.row + 1,
                endLine: minimalNode.endPosition.row + 1,
                fullTextPreview: minimalNode.text.substring(0, 80) + '...'
            });

            // Create anchor for this node
            const anchor = await this.createAnchorFromNode(
                minimalNode,
                line,
                fullCode,
                filePath
            );

            if (!anchor) {
                return undefined;
            }

            console.log(`[AST TRANSFORM] Created anchor:`, {
                path: anchor.path,
                signature: anchor.signature,
                contentHash: anchor.contentHash?.substring(0, 8) + '...'
            });

            // Store the FULL node text, not the LLM fragment
            return {
                anchor,
                originalLine: line,
                originalText: minimalNode.text,  // Full AST node text, not partial LLM fragment
                llmFragment: code  // Keep LLM fragment for debugging/logging
            };
        } catch (error) {
            console.error('Error creating AST node reference:', error);
            return undefined;
        }
    }

    /**
     * Create an AST anchor from a tree-sitter node
     */
    private async createAnchorFromNode(
        node: any,
        originalLine: number,
        fullCode: string,
        filePath: string
    ): Promise<ASTAnchor | undefined> {
        try {
            const nodePath = this.parser.getNodePath(node);
            const signature = this.parser.getFunctionSignature(node);

            // Calculate content hash
            const crypto = require('crypto');
            const contentHash = crypto.createHash('md5').update(node.text).digest('hex');

            const anchor: ASTAnchor = {
                nodeType: node.type,
                nodeName: this.extractNodeName(node) ?? undefined,
                path: nodePath.indices,
                pathTypes: nodePath.types,
                pathNames: nodePath.names,
                signature: signature ?? undefined,
                originalStartLine: node.startPosition.row + 1,
                originalEndLine: node.endPosition.row + 1,
                originalOffset: this.calculateOffset(fullCode, node.startPosition.row),
                contentHash
            };

            return anchor;
        } catch (error) {
            console.error('Error creating anchor from node:', error);
            return undefined;
        }
    }

    /**
     * Find the most meaningful parent node (function, class, etc.)
     */
    private findMeaningfulParent(node: any): any {
        const meaningfulTypes = new Set([
            'function_declaration',
            'method_definition',
            'arrow_function',
            'function_expression',
            'class_declaration',
            'interface_declaration',
            'type_alias_declaration',
            'variable_declaration',
            'lexical_declaration',
            'expression_statement',
            'if_statement',
            'for_statement',
            'while_statement'
        ]);

        let current = node;
        while (current) {
            if (meaningfulTypes.has(current.type)) {
                return current;
            }
            current = current.parent;
        }

        return node;
    }

    /**
     * Extract node name/identifier
     */
    private extractNodeName(node: any): string | undefined {
        const identifierChild = node.children?.find((child: any) =>
            child.type === 'identifier' ||
            child.type === 'property_identifier' ||
            child.type === 'type_identifier'
        );

        return identifierChild?.text || (node.type === 'identifier' ? node.text : undefined);
    }

    /**
     * Calculate character offset for a given line
     */
    private calculateOffset(content: string, line: number): number {
        const lines = content.split('\n');
        let offset = 0;
        for (let i = 0; i < Math.min(line, lines.length); i++) {
            offset += lines[i].length + 1; // +1 for newline
        }
        return offset;
    }

    /**
     * Get structural context for a node (useful for LLM prompts)
     */
    public async getStructuralContext(
        filePath: string,
        fullCode: string,
        startLine: number,
        endLine: number
    ): Promise<{
        enclosingFunction?: string;
        enclosingClass?: string;
        nodeType?: string;
        nestingLevel?: number;
    }> {
        const tree = this.parser.parse(fullCode, filePath);
        if (!tree) {
            return {};
        }

        const node = this.parser.findNodeAtPosition(tree, startLine - 1, 0);
        if (!node) {
            return {};
        }

        const context: any = {
            nodeType: node.type,
            nestingLevel: this.getNestingLevel(node)
        };

        // Find enclosing function
        let current = node;
        while (current) {
            if (current.type.includes('function') || current.type.includes('method')) {
                const funcName = this.extractNodeName(current);
                if (funcName) {
                    context.enclosingFunction = funcName;
                    break;
                }
            }
            current = current.parent;
        }

        // Find enclosing class
        current = node;
        while (current) {
            if (current.type === 'class_declaration') {
                const className = this.extractNodeName(current);
                if (className) {
                    context.enclosingClass = className;
                    break;
                }
            }
            current = current.parent;
        }

        return context;
    }

    /**
     * Calculate nesting level of a node
     */
    private getNestingLevel(node: any): number {
        let level = 0;
        let current = node.parent;
        while (current) {
            level++;
            current = current.parent;
        }
        return level;
    }
}
