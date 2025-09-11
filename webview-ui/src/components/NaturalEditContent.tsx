import { useState, useEffect } from "react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react/index.js";
import { FONT_SIZE, COLORS, SPACING } from "../styles/constants.js";
import { ClipLoader } from "react-spinners";
import { SectionData } from "../types/sectionTypes.js";
import { createStatefulMessageHandler, requestSummary } from "../services/MessageHandler.js";
import SummaryDisplay from "./SummaryDisplay.js";
import PromptPanel from "./PromptPanel.js";
import { vscodeApi } from "../utils/vscodeApi";
import { logInteraction } from "../utils/telemetry";

export function NaturalEditContent() {
    // State for the single section
    const [section, setSection] = useState<SectionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingText, setLoadingText] = useState("Summarizing...");

    // Section validity state
    const [validityStatus, setValidityStatus] = useState<"pending" | "success" | "file_missing" | "code_not_matched">("pending");
    // State for summary edit button: value to load into PromptPanel
    const [editSummaryValue, setEditSummaryValue] = useState<string | null>(null);

    // Always update summary area, even if the same summary is selected
    const handleEditSummary = (summary: string) => {
        // Force clear first to ensure PromptPanel always updates
        setEditSummaryValue(null);
        setTimeout(() => setEditSummaryValue(summary), 0);
    };

    // Setup message handler with progress callback
    useEffect(() => {
        // Handler updates the single section (assume always index 0 if array returned)
        createStatefulMessageHandler(setLoading, setError, (sectionsOrUpdater) => {
            let sections: SectionData[] = [];
            if (Array.isArray(sectionsOrUpdater)) {
                sections = sectionsOrUpdater;
            } else if (typeof sectionsOrUpdater === "function") {
                sections = sectionsOrUpdater([]);
            }
            const newSection = sections && sections.length > 0 ? sections[0] : null;
            setSection(newSection);
            // When a new summary is generated, clear the summary area in PromptPanel
            setEditSummaryValue("");
        }, setLoadingText)();
    }, []);

    // Handler: Summarize Selected Code
    const handleRequestSummary = () => {
        logInteraction("click_summarize_code", {});
        // Clear the summary area in PromptPanel before summarizing new code
        setEditSummaryValue("");
        setLoading(true);
        setError(null);
        setLoadingText("Summarizing...");
        requestSummary();
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

    // Section validity check (copied from SectionBody)
    useEffect(() => {
        if (!section) return;
        vscodeApi.postMessage({
            command: "checkSectionValidity",
            fullPath: section.metadata.fullPath,
            originalCode: section.metadata.originalCode
        });

        function handleMessage(event: MessageEvent) {
            const msg = event.data;
            if (msg && msg.command === "sectionValidityResult") {
                if (msg.status === "success") {
                    setValidityStatus("success");
                } else if (msg.status === "file_missing") {
                    setValidityStatus("file_missing");
                } else if (msg.status === "code_not_matched") {
                    setValidityStatus("code_not_matched");
                }
            }
        }

        window.addEventListener("message", handleMessage);
        return () => {
            window.removeEventListener("message", handleMessage);
        };
    }, [section]);

    // Overlay message based on validity status
    let overlayMessage = "";
    if (validityStatus === "file_missing") {
        overlayMessage = "Code file not found.";
    } else if (validityStatus === "code_not_matched") {
        overlayMessage = "Code snippet cannot be matched.";
    }

    // All mapping/highlight logic removed for baseline

    return (
        <div style={{ width: "100%" }}>
            <h2 style={{
                margin: `${SPACING.LARGE} 0 ${SPACING.MEDIUM} 0`,
                color: COLORS.FOREGROUND,
                fontSize: FONT_SIZE.TITLE
            }}>
                EditHelper
            </h2>
            <div style={{
                color: COLORS.DESCRIPTION,
                marginBottom: SPACING.MEDIUM,
                fontSize: FONT_SIZE.SUBTITLE
            }}>
                Transform your code seamlessly by modifying its natural language representation.
            </div>
            <VSCodeButton
                onClick={handleRequestSummary}
                disabled={loading}
                style={{
                    marginBottom: error ? SPACING.MEDIUM : SPACING.LARGE,
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
                {loading ? loadingText : "Summarize Selected Code"}
            </VSCodeButton>
            {error && (
                <div style={{
                    color: COLORS.ERROR,
                    marginBottom: SPACING.LARGE
                }}>
                    {error}
                </div>
            )}
            {/* Only render section content if section exists */}
            {section && (
                <div style={{
                    position: "relative",
                    padding: SPACING.MEDIUM,
                    background: COLORS.BACKGROUND
                }}>
                    <SummaryDisplay
                        summary={section.summaryData}
                        onEditSummary={handleEditSummary}
                        sectionId={section.metadata.id}
                    />
                    <PromptPanel section={section} editSummaryValue={editSummaryValue} />
                    {validityStatus !== "success" && validityStatus !== "pending" && (
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                background: "rgba(255,255,255,0.7)",
                                zIndex: 10,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                pointerEvents: "auto"
                            }}
                        >
                            <div style={{
                                color: COLORS.ERROR,
                                fontSize: FONT_SIZE.HEADER,
                                fontWeight: "bold",
                                marginBottom: SPACING.MEDIUM,
                                textAlign: "center"
                            }}>
                                {overlayMessage}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
