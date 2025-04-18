// Global type declarations
interface Electron {
  toggleDictation: (callback: () => void) => (() => void);
  showContextMenu: () => void;
  insertTextAtCursor: (text: string) => Promise<{ success: boolean; error?: string }>;
  viewLogFile: () => Promise<void>;
  startRecording: () => Promise<{ success: boolean; error?: string }>;
  stopRecording: () => Promise<{ success: boolean; error?: string }>;
  transcribeAudio: (audioData: Uint8Array) => Promise<{ success: boolean; text?: string; error?: string }>;
}

interface Window {
  electron?: Electron;
} 