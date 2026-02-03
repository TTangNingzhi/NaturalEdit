import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { ASTParser } from './astParser';
import { ASTAnchor, ASTLocateResult } from '../types/astTypes';

/**
 * Locates code in files using purely AST-based strategies (no text matching fallback)
 */
export class ASTCodeLocator {
    private parser: ASTParser;
    private documentCache: Map<string, { content: string; tree: any; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 60000; // 1 minute

    constructor() {
        this.parser = ASTParser.getInstance();
    }

    /**
     * Create an AST anchor for a code region
     */
    public async createAnchor(
        filePath: string,
        code: string,
        startLine: number,
        endLine: number,
        offset: number
    ): Promise<ASTAnchor | null> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const fullContent = document.getText();

            const tree = this.parser.parse(fullContent, filePath);
            if (!tree) {
                console.warn('Failed to parse file for AST anchor creation:', filePath);
                return null;
            }

            // Find node at the start position (convert to 0-based)
            const node = this.parser.findNodeAtPosition(tree, startLine - 1, 0);
            if (!node) {
                console.warn('Could not find AST node at position:', startLine);
                return null;
            }

            // Find the most specific meaningful parent node (function, class, etc.)
            const meaningfulNode = this.findMeaningfulParent(node);

            // Get path to this node
            const nodePath = this.parser.getNodePath(meaningfulNode);

            // Get signature if it's a function
            const signature = this.parser.getFunctionSignature(meaningfulNode);

            // Calculate content hash
            const contentHash = this.hashContent(code);

            const anchor: ASTAnchor = {
                nodeType: meaningfulNode.type,
                nodeName: this.extractNodeName(meaningfulNode) ?? undefined,
                path: nodePath.indices,
                pathTypes: nodePath.types,
                pathNames: nodePath.names,
                signature: signature ?? undefined,
                originalStartLine: startLine,
                originalEndLine: endLine,
                originalOffset: offset,
                contentHash
            };

            return anchor;
        } catch (error) {
            console.error('Error creating AST anchor:', error);
            return null;
        }
    }

    /**
     * Locate code using AST anchor with multiple fallback strategies
     */
    public async locateCode(
        filePath: string,
        originalCode: string,
        offset: number,
        astAnchor?: ASTAnchor
    ): Promise<ASTLocateResult> {
        try {
            // Get current file content
            const document = await vscode.workspace.openTextDocument(filePath);
            const currentContent = document.getText();

            // Strategy 1: Try AST path-based location if anchor exists
            if (astAnchor) {
                const astResult = await this.locateByASTPath(
                    filePath,
                    currentContent,
                    astAnchor
                );
                if (astResult.found && astResult.confidence > 0.8) {
                    return astResult;
                }

                // Strategy 2: Try signature-based matching
                if (astAnchor.signature) {
                    const sigResult = await this.locateBySignature(
                        filePath,
                        currentContent,
                        astAnchor
                    );
                    if (sigResult.found && sigResult.confidence > 0.7) {
                        return sigResult;
                    }
                }

                // Strategy 3: Try fuzzy AST matching (find similar nodes)
                const fuzzyResult = await this.locateByFuzzyAST(
                    filePath,
                    currentContent,
                    astAnchor,
                    originalCode
                );
                if (fuzzyResult.found && fuzzyResult.confidence > 0.6) {
                    return fuzzyResult;
                }
            }

            // All AST strategies failed - return failure (no text fallback)
            console.warn('[ASTCodeLocator] All AST strategies failed for code location');
            return {
                found: false,
                method: 'not-found',
                confidence: 0,
                error: 'All AST strategies failed to locate the code'
            };

        } catch (error) {
            console.error('Error locating code:', error);
            return {
                found: false,
                method: 'not-found',
                confidence: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Strategy 1: Locate by AST path
     */
    private async locateByASTPath(
        filePath: string,
        content: string,
        anchor: ASTAnchor
    ): Promise<ASTLocateResult> {
        try {
            const tree = this.parser.parse(content, filePath);
            if (!tree) {
                return { found: false, method: 'ast-path', confidence: 0 };
            }

            // Try to find node by path
            const node = this.parser.findNodeByPath(tree, {
                indices: anchor.path,
                types: anchor.pathTypes,
                names: anchor.pathNames
            });

            if (!node) {
                return { found: false, method: 'ast-path', confidence: 0 };
            }

            // Verify node characteristics match
            const confidence = this.calculateNodeMatchConfidence(node, anchor);

            if (confidence > 0.8) {
                // Convert from 0-based row to 1-based line number
                const startLine = node.startPosition.row + 1;
                const endLine = node.endPosition.row + 1;

                return {
                    found: true,
                    currentLines: [startLine, endLine],
                    currentCode: node.text,
                    method: 'ast-path',
                    confidence
                };
            }

            return { found: false, method: 'ast-path', confidence };
        } catch (error) {
            console.error('Error in AST path location:', error);
            return { found: false, method: 'ast-path', confidence: 0 };
        }
    }

    /**
     * Strategy 2: Locate by function/method signature
     */
    private async locateBySignature(
        filePath: string,
        content: string,
        anchor: ASTAnchor
    ): Promise<ASTLocateResult> {
        try {
            if (!anchor.signature || !anchor.nodeName) {
                return { found: false, method: 'ast-signature', confidence: 0 };
            }

            const tree = this.parser.parse(content, filePath);
            if (!tree) {
                return { found: false, method: 'ast-signature', confidence: 0 };
            }

            // Find function by name
            const node = this.parser.findFunctionByName(tree, anchor.nodeName);
            if (!node) {
                return { found: false, method: 'ast-signature', confidence: 0 };
            }

            // Verify signature matches
            const currentSignature = this.parser.getFunctionSignature(node);
            const signatureMatch = currentSignature === anchor.signature;

            const confidence = signatureMatch ? 0.9 : 0.5;

            if (confidence > 0.7) {
                // Convert from 0-based row to 1-based line number
                const startLine = node.startPosition.row + 1;
                const endLine = node.endPosition.row + 1;

                return {
                    found: true,
                    currentLines: [startLine, endLine],
                    currentCode: node.text,
                    method: 'ast-signature',
                    confidence
                };
            }

            return { found: false, method: 'ast-signature', confidence };
        } catch (error) {
            console.error('Error in signature-based location:', error);
            return { found: false, method: 'ast-signature', confidence: 0 };
        }
    }

    /**
     * Strategy 3: Fuzzy AST matching - find similar nodes
     */
    private async locateByFuzzyAST(
        filePath: string,
        content: string,
        anchor: ASTAnchor,
        originalCode: string
    ): Promise<ASTLocateResult> {
        try {
            const tree = this.parser.parse(content, filePath);
            if (!tree) {
                return { found: false, method: 'ast-fuzzy', confidence: 0 };
            }

            // Find all nodes of the same type
            const candidates = this.parser.findNodesByType(tree, anchor.nodeType);

            let bestMatch: any = null;
            let bestScore = 0;

            for (const candidate of candidates) {
                const score = this.calculateNodeSimilarity(candidate, anchor, originalCode);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = candidate;
                }
            }

            if (bestMatch && bestScore > 0.6) {
                // Convert from 0-based row to 1-based line number
                const startLine = bestMatch.startPosition.row + 1;
                const endLine = bestMatch.endPosition.row + 1;

                return {
                    found: true,
                    currentLines: [startLine, endLine],
                    currentCode: bestMatch.text,
                    method: 'ast-fuzzy',
                    confidence: bestScore
                };
            }

            return { found: false, method: 'ast-fuzzy', confidence: bestScore };
        } catch (error) {
            console.error('Error in fuzzy AST location:', error);
            return { found: false, method: 'ast-fuzzy', confidence: 0 };
        }
    }

    /**
     * Calculate how well a node matches the anchor characteristics
     */
    private calculateNodeMatchConfidence(node: any, anchor: ASTAnchor): number {
        let score = 0;
        let checks = 0;

        // Check node type
        if (node.type === anchor.nodeType) {
            score += 0.3;
        }
        checks++;

        // Check node name
        const nodeName = this.extractNodeName(node);
        if (nodeName && anchor.nodeName && nodeName === anchor.nodeName) {
            score += 0.3;
        }
        checks++;

        // Check signature
        if (anchor.signature) {
            const currentSig = this.parser.getFunctionSignature(node);
            if (currentSig === anchor.signature) {
                score += 0.2;
            }
            checks++;
        }

        // Check content hash if available
        if (anchor.contentHash) {
            const currentHash = this.hashContent(node.text);
            if (currentHash === anchor.contentHash) {
                score += 0.2;
            }
            checks++;
        }

        return checks > 0 ? score : 0;
    }

    /**
     * Calculate similarity between a candidate node and the anchor.
     * Uses PURELY STRUCTURAL matching - no text similarity.
     */
    private calculateNodeSimilarity(
        node: any,
        anchor: ASTAnchor,
        originalCode: string
    ): number {
        let score = 0;

        // Type match (strong signal - 40%)
        if (node.type === anchor.nodeType) {
            score += 0.4;
        }

        // Name match (strong signal - 40%)
        const nodeName = this.extractNodeName(node);
        if (nodeName && anchor.nodeName && nodeName === anchor.nodeName) {
            score += 0.4;
        }

        // Position proximity (weak signal - 20%)
        // Nodes closer to original position are slightly preferred
        const lineDiff = Math.abs(node.startPosition.row + 1 - anchor.originalStartLine);
        const proximityScore = Math.max(0, 0.2 * (1 - lineDiff / 100));
        score += proximityScore;

        // Total: 1.0 for perfect structural match (type + name + same position)
        return score;
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
            'lexical_declaration'
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
     * Hash content for quick comparison
     */
    private hashContent(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Clear the document cache
     */
    public clearCache(): void {
        this.documentCache.clear();
    }
}
