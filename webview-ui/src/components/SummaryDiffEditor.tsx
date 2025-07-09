import React, { useState, useRef } from "react";
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react";
import DiffMatchPatch from "diff-match-patch";
import { FONT_SIZE } from "../styles/constants";

/**
 * SummaryDiffEditor
 * 
 * Props:
 * - originalSummary: string - The original summary to compare against
 * - currentSummary: string - The current summary (editable)
 * - onChange: (newSummary: string) => void - Callback when summary is changed
 * 
 * Features:
 * - Shows a diff view (additions in green, deletions in red with strikethrough)
 * - Clicking the diff view switches to an editable textarea
 * - On blur or Enter, saves and switches back to diff view
 * - Uses VSCodeTextArea for editing, and VSCode design for UI
 */
interface SummaryDiffEditorProps {
    originalSummary: string;
    currentSummary: string;
    onChange: (newSummary: string) => void;
}

const dmp = new DiffMatchPatch();

export const SummaryDiffEditor: React.FC<SummaryDiffEditorProps> = ({
    originalSummary,
    currentSummary,
    onChange,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(currentSummary);
    // Use a wrapper ref to access the underlying textarea for focus
    const textAreaWrapperRef = useRef<HTMLDivElement | null>(null);

    // Generate diff between original and current summary
    const getDiffElements = () => {
        const diffs = dmp.diff_main(originalSummary, currentSummary);
        dmp.diff_cleanupSemantic(diffs);

        return diffs.map(([op, text], idx) => {
            if (op === DiffMatchPatch.DIFF_INSERT) {
                // Addition: green (no background)
                return (
                    <span
                        key={idx}
                        style={{
                            color: "var(--vscode-charts-green, #008000)",
                            fontWeight: 500,
                        }}
                    >
                        {text}
                    </span>
                );
            } else if (op === DiffMatchPatch.DIFF_DELETE) {
                // Deletion: red with strikethrough (no background)
                return (
                    <span
                        key={idx}
                        style={{
                            color: "var(--vscode-charts-red, #d32f2f)",
                            textDecoration: "line-through",
                            fontWeight: 500,
                        }}
                    >
                        {text}
                    </span>
                );
            } else {
                // Unchanged: default
                return <span key={idx}>{text}</span>;
            }
        });
    };

    // Handle switching to edit mode
    const handleDiffClick = () => {
        setEditValue(currentSummary);
        setIsEditing(true);
        // Focus will be handled in useEffect
    };

    // Handle blur or Enter key in textarea
    const handleBlurOrSubmit = React.useCallback(() => {
        setIsEditing(false);
        if (editValue !== currentSummary) {
            onChange(editValue);
        }
    }, [editValue, currentSummary, onChange]);

    // No special Enter key handling: Enter always inserts a newline in textarea mode

    // Auto-focus textarea when entering edit mode
    React.useEffect(() => {
        if (isEditing && textAreaWrapperRef.current) {
            const textarea = textAreaWrapperRef.current.querySelector("textarea");
            if (textarea) {
                (textarea as HTMLTextAreaElement).focus();
            }
        }
    }, [isEditing, handleBlurOrSubmit]);

    // Click outside to exit edit mode
    React.useEffect(() => {
        if (!isEditing) return;
        const handleClick = (e: MouseEvent) => {
            if (
                textAreaWrapperRef.current &&
                !textAreaWrapperRef.current.contains(e.target as Node)
            ) {
                handleBlurOrSubmit();
            }
        };
        document.addEventListener("mousedown", handleClick, true);
        return () => {
            document.removeEventListener("mousedown", handleClick, true);
        };
    }, [isEditing, handleBlurOrSubmit]);

    return (
        <div>
            {isEditing ? (
                <div ref={textAreaWrapperRef}>
                    <VSCodeTextArea
                        value={editValue}
                        onInput={e => setEditValue((e.target as HTMLTextAreaElement).value)}
                        onBlur={handleBlurOrSubmit}
                        rows={Math.max(5, editValue.split("\n").length)}
                        style={{
                            width: "100%",
                            fontFamily: "monospace",
                            fontSize: `${FONT_SIZE.SMALL}px`,
                            minHeight: "6em"
                        }}
                        placeholder="Load the summary above and edit here."
                    />
                </div>
            ) : (
                <div
                    onClick={handleDiffClick}
                    style={{
                        cursor: "pointer",
                        minHeight: "6em",
                        padding: "8px",
                        border: "1px solid var(--vscode-input-border, #3c3c3c)",
                        borderRadius: "4px",
                        background: "var(--vscode-input-background, #1e1e1e)",
                        color: "var(--vscode-input-foreground, #d4d4d4)",
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        fontSize: `${FONT_SIZE.SMALL}px`,
                        outline: "none",
                    }}
                    title="Click to edit"
                    tabIndex={0}
                    role="button"
                    onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                            handleDiffClick();
                        }
                    }}
                >
                    {currentSummary.trim()
                        ? getDiffElements()
                        : <span style={{ color: "var(--vscode-descriptionForeground, #888)" }}>Load the summary above and edit here.</span>
                    }
                </div>
            )}
        </div>
    );
};

export default SummaryDiffEditor;
