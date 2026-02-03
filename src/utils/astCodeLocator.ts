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

    constructor() {
        this.parser = ASTParser.getInstance();
    }

    /**
     * Create an AST anchor for a code region
     * 
     * LOGIC:
     * 1. Find the minimal node at startLine (the actual smallest AST node)
     * 2. Calculate the COMPLETE path from root to this minimal node
     * 3. Return anchor with minimalNode fields and path information
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

            // STEP 1: Find the minimal node at startLine (the actual smallest AST node)
            // Use findMinimalContainingNode to get the actual smallest node that contains the code
            // This is more accurate than findNodeAtPosition at column 0, which might return shallow nodes
            const firstLine = code.split('\n')[0];
            let minimalNode = this.parser.findMinimalContainingNode(tree, startLine, firstLine);

            // Fallback: If minimal node not found, try finding node at first non-whitespace character
            if (!minimalNode) {
                console.warn(`[createAnchor] findMinimalContainingNode failed, trying position-based search`);
                const lineText = document.lineAt(startLine - 1).text;
                const firstNonWhitespace = lineText.search(/\S/);
                const column = firstNonWhitespace >= 0 ? firstNonWhitespace : 0;
                minimalNode = this.parser.findNodeAtPosition(tree, startLine - 1, column);

                if (!minimalNode) {
                    console.warn('Could not find AST node at position:', startLine);
                    return null;
                }
            }

            console.log('[createAnchor] Found minimal node:', {
                type: minimalNode.type,
                startLine: minimalNode.startPosition.row + 1,
                endLine: minimalNode.endPosition.row + 1,
                textPreview: minimalNode.text.substring(0, 60) + '...'
            });

            // STEP 2: Get COMPLETE path from root to minimal node
            // This path is not filtered by any semantic criteria
            const minimalNodePath = this.parser.getNodePath(minimalNode);

            // STEP 3: Calculate content hash for minimal node
            const contentHash = this.hashContent(minimalNode.text);

            // STEP 4: Build anchor with minimal node fields
            const anchor: ASTAnchor = {
                // Minimal node fields (ALWAYS present)
                minimalNodeType: minimalNode.type,
                minimalNodeName: this.extractNodeName(minimalNode) ?? undefined,

                // Path to minimal node (ALWAYS present, complete)
                path: minimalNodePath.indices,
                pathTypes: minimalNodePath.types,
                pathNames: minimalNodePath.names,

                // Metadata
                originalStartLine: startLine,
                originalEndLine: endLine,
                originalOffset: offset,
                contentHash
            };

            console.log('[ASTCodeLocator.createAnchor] Created anchor:', {
                minimalNodeType: anchor.minimalNodeType,
                minimalNodeName: anchor.minimalNodeName,
                pathLength: anchor.path.length
            });

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

            // Strategy: AST path-based location
            if (astAnchor) {
                const astResult = await this.locateByASTPath(
                    filePath,
                    currentContent,
                    astAnchor
                );
                if (astResult.found && astResult.confidence > 0) {
                    return astResult;
                }
            }

            // AST path matching failed - return failure
            console.warn('[ASTCodeLocator] AST path matching failed for code location');
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

            console.log(`[locateByASTPath] Attempting to find node by path:`, {
                path: anchor.path,
                pathTypes: anchor.pathTypes,
                pathNames: anchor.pathNames
            });

            // Try flexible path matching (prioritizes type > name > position)
            const flexResult = this.parser.findNodeByPathFlexible(tree, {
                indices: anchor.path,
                types: anchor.pathTypes,
                names: anchor.pathNames
            });

            let node: any = null;
            let pathConfidence = 0;

            if (flexResult && flexResult.node) {
                node = flexResult.node;
                pathConfidence = flexResult.confidence;
                console.log(`[locateByASTPath] Flexible match found with path confidence: ${pathConfidence.toFixed(3)}`);
            } else {
                console.log(`[locateByASTPath] Failed: Could not find node by flexible path matching`);
                return { found: false, method: 'ast-path', confidence: 0 };
            }

            console.log(`[locateByASTPath] Found node:`, {
                type: node.type,
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1
            });

            // Verify node characteristics match and combine with path confidence
            const nodeConfidence = this.calculateNodeMatchConfidence(node, anchor);
            const finalConfidence = pathConfidence * nodeConfidence;

            console.log(`[locateByASTPath] Node match confidence: ${nodeConfidence.toFixed(3)}, Final confidence: ${finalConfidence.toFixed(3)}`);

            if (finalConfidence > 0) {
                // Convert from 0-based row to 1-based line number
                const startLine = node.startPosition.row + 1;
                const endLine = node.endPosition.row + 1;

                return {
                    found: true,
                    currentLines: [startLine, endLine],
                    currentRange: {
                        startLine: startLine,
                        startColumn: node.startPosition.column,
                        endLine: endLine,
                        endColumn: node.endPosition.column
                    },
                    currentCode: node.text,
                    method: 'ast-path',
                    confidence: finalConfidence
                };
            }

            return { found: false, method: 'ast-path', confidence: finalConfidence };
        } catch (error) {
            console.error('Error in AST path location:', error);
            return { found: false, method: 'ast-path', confidence: 0 };
        }
    }

    /**
     * Calculate confidence score for how well a node matches the anchor
     * 
     * LOGIC:
     * - Check minimalNodeType (required field)
     * - Check minimalNodeName if available
     * - Check content hash if available
     */
    private calculateNodeMatchConfidence(node: any, anchor: ASTAnchor): number {
        let score = 0;

        // Check MINIMAL node type (always present)
        if (node.type === anchor.minimalNodeType) {
            score += 0.4;
        }

        // Check MINIMAL node name (if both have it)
        const nodeName = this.extractNodeName(node);
        if (nodeName && anchor.minimalNodeName && nodeName === anchor.minimalNodeName) {
            score += 0.4;
        }

        // Check content hash if available
        if (anchor.contentHash) {
            const currentHash = this.hashContent(node.text);
            if (currentHash === anchor.contentHash) {
                score += 0.2;
            }
        }

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
