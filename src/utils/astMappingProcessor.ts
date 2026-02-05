import { ASTParser } from './astParser';
import { ASTAnchor, ASTNodeReference } from '../types/astTypes';

/**
 * Post-processes LLM-generated mappings to add AST node references
 */
export class ASTMappingProcessor {
    private parser: ASTParser;

    constructor() {
        this.parser = ASTParser.getInstance();
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
     * Build AST-based code segments for the entire session selection.
     * This captures the structural nodes covering the selected range, line by line.
     */
    public async buildSessionSegments(
        filePath: string,
        fullCode: string,
        startLine: number,
        endLine: number
    ): Promise<Array<{ code: string; line: number; astNodeRef?: ASTNodeReference }>> {
        const tree = this.parser.parse(fullCode, filePath);
        if (!tree) {
            return [];
        }

        const lines = fullCode.split('\n');
        const segments: Array<{ code: string; line: number; astNodeRef?: ASTNodeReference }> = [];
        const seenNodes = new Set<string>();

        for (let line = startLine; line <= endLine; line++) {
            const lineText = lines[line - 1] ?? '';
            if (lineText.trim().length === 0) {
                continue;
            }

            let minimalNode = this.parser.findMinimalContainingNode(tree, line, lineText.trim());
            if (!minimalNode) {
                const firstNonWhitespace = lineText.search(/\S/);
                const column = firstNonWhitespace >= 0 ? firstNonWhitespace : 0;
                minimalNode = this.parser.findNodeAtPosition(tree, line - 1, column);
                if (!minimalNode) {
                    continue;
                }
            }

            const nodeId = `${minimalNode.type}-${minimalNode.startPosition.row}-${minimalNode.startPosition.column}-${minimalNode.endPosition.row}-${minimalNode.endPosition.column}`;
            if (seenNodes.has(nodeId)) {
                continue;
            }
            seenNodes.add(nodeId);

            const anchor = await this.createAnchorFromNode(minimalNode, line, fullCode, filePath);
            if (!anchor) {
                continue;
            }

            segments.push({
                code: lineText,
                line,
                astNodeRef: {
                    anchor,
                    originalLine: line,
                    originalText: minimalNode.text,
                    llmFragment: lineText
                }
            });
        }

        return segments;
    }

    /**
     * Create an AST node reference for a code segment.
     * 
     * NEW LOGIC:
     * 1. Find the minimal AST node that contains the LLM's text fragment
     * 2. Find meaningful ancestor (if any) above the minimal node
     * 3. Create anchor with path to minimal node + meaningful ancestor info (optional)
     * 4. Return reference with FULL minimal node text (not LLM fragment)
     */
    private async createNodeReference(
        tree: any,
        code: string,
        line: number,
        fullCode: string,
        filePath: string
    ): Promise<ASTNodeReference | undefined> {
        try {
            // STEP 1: Find the minimal AST node that contains the LLM's text fragment
            let minimalNode = this.parser.findMinimalContainingNode(tree, line, code);

            // Fallback: If minimal node not found, use position-based method
            if (!minimalNode) {
                const lineText = fullCode.split('\n')[line - 1];
                const firstNonWhitespace = lineText?.search(/\S/) ?? 0;
                const column = firstNonWhitespace >= 0 ? firstNonWhitespace : 0;
                minimalNode = this.parser.findNodeAtPosition(tree, line - 1, column);
                if (!minimalNode) {
                    return undefined;
                }
            }

            // STEP 2: Create anchor for this minimal node
            // The createAnchorFromNode will handle finding meaningful ancestors
            const anchor = await this.createAnchorFromNode(
                minimalNode,
                line,
                fullCode,
                filePath
            );

            if (!anchor) {
                return undefined;
            }

            // STEP 3: Return reference with FULL minimal node text
            return {
                anchor,
                originalLine: line,
                originalText: minimalNode.text,  // Full minimal node text, not LLM fragment
                llmFragment: code  // Keep LLM fragment for debugging
            };
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Create an AST anchor from a tree-sitter node
     * 
     * NEW LOGIC:
     * 1. The passed node IS the minimal node
     * 2. Calculate path from root to this minimal node (complete, unfiltered)
     * 3. Find meaningful ancestor (if exists)
     * 4. Extract semantic info from meaningful ancestor
     * 5. Fill anchor with minimalNode fields + optional meaningful fields
     */
    private async createAnchorFromNode(
        minimalNode: any,
        originalLine: number,
        fullCode: string,
        filePath: string
    ): Promise<ASTAnchor | undefined> {
        try {
            // STEP 1: Get complete path from root to minimal node
            const minimalNodePath = this.parser.getNodePath(minimalNode);

            // STEP 2: Calculate content hash for minimal node
            const crypto = require('crypto');
            const contentHash = crypto.createHash('md5').update(minimalNode.text).digest('hex');

            // STEP 3: Build anchor with minimal node information
            const anchor: ASTAnchor = {
                // Minimal node fields (ALWAYS present)
                minimalNodeType: minimalNode.type,
                minimalNodeName: this.extractNodeName(minimalNode) ?? undefined,

                // Path to minimal node (ALWAYS present, complete)
                path: minimalNodePath.indices,
                pathTypes: minimalNodePath.types,
                pathNames: minimalNodePath.names,

                // Metadata
                originalStartLine: minimalNode.startPosition.row + 1,
                originalEndLine: minimalNode.endPosition.row + 1,
                originalOffset: this.calculateOffset(fullCode, minimalNode.startPosition.row),
                contentHash
            };

            return anchor;
        } catch (error) {
            console.error('Error creating anchor from node:', error);
            return undefined;
        }
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
