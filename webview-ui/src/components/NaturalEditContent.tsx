import { useState, useEffect } from "react";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react/index.js";
import { FONT_SIZE, COLORS, SPACING } from "../styles/constants.js";
import { ClipLoader } from "react-spinners";
import SectionList from "./SectionList.js";
import { SectionData } from "../types/sectionTypes.js";
import { createStatefulMessageHandler, requestSummary } from "../services/MessageHandler.js";

interface NaturalEditContentProps {
    onSectionsChange: (sections: SectionData[]) => void;
}

export function NaturalEditContent({ onSectionsChange }: NaturalEditContentProps) {
    // State for all code-summary pairs
    const [sectionList, setSectionList] = useState<SectionData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Setup message handler
    useEffect(() => {
        createStatefulMessageHandler(setLoading, setError, setSectionList)();
    }, []);

    // Handler: Summarize Selected Code
    const handleRequestSummary = () => {
        setLoading(true);
        setError(null);
        requestSummary();
    };

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
                Transform your code seamlessly by modifying its natural language descriptions.
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
                {loading ? "Summarizing..." : "Summarize Selected Code"}
            </VSCodeButton>
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