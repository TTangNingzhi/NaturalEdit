import * as vscode from "vscode";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

function getFirebaseConfig() {
    const cfg = vscode.workspace.getConfiguration('naturaledit.firebase');
    return {
        apiKey: cfg.get<string>('apiKey') || '',
        authDomain: cfg.get<string>('authDomain') || '',
        projectId: cfg.get<string>('projectId') || '',
        storageBucket: cfg.get<string>('storageBucket') || '',
        messagingSenderId: cfg.get<string>('messagingSenderId') || '',
        appId: cfg.get<string>('appId') || '',
        measurementId: cfg.get<string>('measurementId') || ''
    };
}

function isTelemetryEnabled() {
    const cfg = vscode.workspace.getConfiguration('naturaledit');
    return cfg.get<boolean>('telemetry.enabled', true);
}

let app;
const firebaseConfig = getFirebaseConfig();
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}
const db = getFirestore(app);

function getTodayCollectionName() {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })); // Force Eastern Time directly
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `pasta_interaction_${yyyy}_${mm}_${dd}`;
}

function getFormattedTimestamp() {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })); // Force Eastern Time directly
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${ms}`;
}

/**
 * Log interaction from backend.
 * @param event The event name or type.
 * @param data The event data.
 */
export async function logInteraction(event: string, data: object) {
    if (!isTelemetryEnabled()) {
        return;
    }

    const log = {
        timestamp: getFormattedTimestamp(),
        source: 'backend',
        event,
        data
    };
    try {
        await addDoc(collection(db, getTodayCollectionName()), log);
    } catch (e) {
        console.error('Failed to log interaction to Firebase:', e);
    }
}

/**
 * Log interaction received from frontend.
 * Expects log to have timestamp, source, event, data.
 */
export async function logInteractionFromFrontend(log: { timestamp: string, source: string, event: string, data: any }) {
    if (!isTelemetryEnabled()) {
        return;
    }

    try {
        await addDoc(collection(db, getTodayCollectionName()), log);
    } catch (e) {
        console.error('Failed to log interaction from frontend to Firebase:', e);
    }
}