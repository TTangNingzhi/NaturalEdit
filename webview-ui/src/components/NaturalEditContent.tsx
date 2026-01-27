import { useState, useEffect } from "react";
import { VSCodeButton, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react/index.js";
import { FONT_SIZE, COLORS, SPACING } from "../styles/constants.js";
import { ClipLoader } from "react-spinners";
import SectionList from "./SectionList.js";
import { SectionData } from "../types/sectionTypes.js";
import { createStatefulMessageHandler, requestSummary } from "../services/MessageHandler.js";
import { logInteraction } from "../utils/telemetry";

interface NaturalEditContentProps {
    onSectionsChange: (sections: SectionData[]) => void;
}

export function NaturalEditContent({ onSectionsChange }: NaturalEditContentProps) {
    // State for all code-summary pairs
    const [sectionList, setSectionList] = useState<SectionData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // State for loading text (progress message)
    const [loadingText, setLoadingText] = useState("Summarizing...");
    // State for custom instruction wand button
    const [isWandActive, setIsWandActive] = useState(false);
    const [customInstruction, setCustomInstruction] = useState("");

    // Setup message handler with progress callback
    useEffect(() => {
        createStatefulMessageHandler(setLoading, setError, setSectionList, setLoadingText)();
    }, []);

    // Handler: Summarize Selected Code
    const handleRequestSummary = () => {
        logInteraction("click_summarize_code", {});
        setLoading(true);
        setError(null);
        setLoadingText("Summarizing..."); // Reset to default at start
        const instruction = isWandActive && customInstruction.trim() ? customInstruction.trim() : undefined;
        requestSummary(undefined, undefined, instruction);
    };

    // Handler: Toggle wand active state
    const handleWandToggle = () => {
        const newActiveState = !isWandActive;
        setIsWandActive(newActiveState);
        logInteraction("toggle_custom_instruction", { active: newActiveState });
    };

    // Reset loading text on error or when not loading
    useEffect(() => {
        if (!loading) {
            setLoadingText("Summarizing...");
        }
    }, [loading]);
    useEffect(() => {
        if (error) {
            setLoadingText("Summarizing...");
        }
    }, [error]);

    // Update parent component when sections change
    useEffect(() => {
        onSectionsChange(sectionList);
    }, [sectionList, onSectionsChange]);

    return (
        <div style={{ width: "100%" }}>
            <h2 style={{
                margin: `${SPACING.LARGE} 0 ${SPACING.MEDIUM} 0`,
                color: COLORS.FOREGROUND,
                fontSize: FONT_SIZE.TITLE
            }}>
                NaturalEdit
            </h2>
            <div style={{
                color: COLORS.DESCRIPTION,
                marginBottom: SPACING.MEDIUM,
                fontSize: FONT_SIZE.SUBTITLE
            }}>
                Transform your code seamlessly by modifying its natural language representation.
            </div>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: SPACING.SMALL,
                marginBottom: isWandActive ? SPACING.SMALL : (error ? SPACING.MEDIUM : SPACING.LARGE)
            }}>
                <VSCodeButton
                    onClick={handleRequestSummary}
                    disabled={loading}
                    style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    {loading && (
                        <ClipLoader
                            color={COLORS.BUTTON_FOREGROUND}
                            size={FONT_SIZE.TINY}
                            cssOverride={{
                                borderWidth: '2px',
                                marginRight: SPACING.SMALL
                            }}
                        />
                    )}
                    {/* Show progress text if loading, otherwise default button text */}
                    {loading ? loadingText : "Summarize Selected Code"}
                </VSCodeButton>
                <VSCodeButton
                    appearance="icon"
                    onClick={handleWandToggle}
                    disabled={loading}
                    title={isWandActive ? "Deactivate Custom Instruction" : "Activate Custom Instruction"}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <span className="codicon codicon-wand" style={{ fontSize: "16px" }}></span>
                </VSCodeButton>
            </div>
            {isWandActive && (
                <div style={{ marginBottom: error ? SPACING.MEDIUM : SPACING.LARGE }}>
                    <VSCodeTextArea
                        value={customInstruction}
                        placeholder="E.g., Focus on security risks"
                        onInput={(e) => setCustomInstruction((e.target as HTMLTextAreaElement).value)}
                        rows={2}
                        style={{
                            width: "100%",
                            resize: "vertical"
                        }}
                    />
                </div>
            )}
            {error && (
                <div style={{
                    color: COLORS.ERROR,
                    marginBottom: SPACING.LARGE
                }}>
                    {error}
                </div>
            )}
            <SectionList
                sections={sectionList}
                onSectionsChange={setSectionList}
            />
        </div>
    );
}
