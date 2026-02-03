import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { ASTParser } from './astParser';
import { ASTAnchor, ASTLocateResult } from '../types/astTypes';
import DiffMatchPatch from 'diff-match-patch';

/**
 * Locates code in files using AST-based anchoring with fallback to text matching
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

            // Strategy 4: Fallback to text-based matching
            const textResult = await this.locateByText(
                currentContent,
                originalCode,
                offset
            );
            return textResult;

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
     * Strategy 4: Text-based fallback using existing fuzzy matching
     */
    private async locateByText(
        content: string,
        originalCode: string,
        offset: number
    ): Promise<ASTLocateResult> {
        try {
            // Try exact match first
            let location = content.indexOf(originalCode, offset);
            let confidence = 1.0;

            // Try fuzzy match if exact fails
            if (location === -1) {
                const dmp = new DiffMatchPatch();
                location = dmp.match_main(content, originalCode, offset);
                if (location !== -1) {
                    confidence = 0.8;
                }
            }

            if (location !== -1) {
                // Calculate line numbers from character positions
                const lines = content.substring(0, location).split('\n');
                const startLine = lines.length;
                const endContent = content.substring(0, location + originalCode.length);
                const endLine = endContent.split('\n').length;

                return {
                    found: true,
                    currentLines: [startLine, endLine],
                    currentCode: content.substring(location, location + originalCode.length),
                    method: 'text-fallback',
                    confidence
                };
            }

            return {
                found: false,
                method: 'text-fallback',
                confidence: 0
            };
        } catch (error) {
            console.error('Error in text-based location:', error);
            return {
                found: false,
                method: 'text-fallback',
                confidence: 0
            };
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
     * Calculate similarity between a candidate node and the anchor
     */
    private calculateNodeSimilarity(
        node: any,
        anchor: ASTAnchor,
        originalCode: string
    ): number {
        let score = 0;

        // Type match (strong signal)
        if (node.type === anchor.nodeType) {
            score += 0.3;
        }

        // Name match (strong signal)
        const nodeName = this.extractNodeName(node);
        if (nodeName && anchor.nodeName && nodeName === anchor.nodeName) {
            score += 0.3;
        }

        // Position proximity (weak signal)
        const lineDiff = Math.abs(node.startPosition.row + 1 - anchor.originalStartLine);
        const proximityScore = Math.max(0, 0.2 * (1 - lineDiff / 100));
        score += proximityScore;

        // Text similarity (medium signal)
        const textSimilarity = this.calculateTextSimilarity(node.text, originalCode);
        score += textSimilarity * 0.2;

        return score;
    }

    /**
     * Calculate text similarity between two strings
     */
    private calculateTextSimilarity(text1: string, text2: string): number {
        // Simple Levenshtein-based similarity
        const longer = text1.length > text2.length ? text1 : text2;
        const shorter = text1.length > text2.length ? text2 : text1;

        if (longer.length === 0) {
            return 1.0;
        }

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
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
