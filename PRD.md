# Sonic Flow – Combined Design & PRD (Simplified)

## 1. High-Level Overview
Sonic Flow is a **minimal AI-powered dictation tool** designed to blend seamlessly into a user’s workflow. All subscription and usage data is managed on a **web dashboard**, freeing the actual app UI to remain as a **small “pill-shaped” icon** on-screen (or hidden if the user chooses). This “pill” expands when hovered over or activated by a hotkey, provides live audio feedback during dictation, and transcribes text directly into the user’s cursor position.

## 2. Core Goals

1. **Unobtrusive Dictation:** Provide minimal on-screen presence—a small pill icon that can expand when needed.
2. **Seamless Transcription:** Convert speech to text in real-time with an audio feedback waveform and a quick loading/processing state upon completion.
3. **Simple Access to Settings:** Basic right-click menu with a few options (hotkey customization, hide-timer, profile settings link).
4. **Web Dashboard for Accounts & Usage:** Users manage subscriptions, usage analytics, and profiles entirely online (similar to Cursor).

## 3. User Flow

1. **App Launch / Login:**
   - The user logs in via the **website** and configures usage/subscription details there.
   - The Electron app then recognizes the login status (e.g., via OAuth token or similar) and stays **lightweight** on the desktop.

2. **Idle State (Pill Icon):**
   - A small **pill-shaped icon** floats or docks on the screen (customizable placement).
   - By default, it might sit in the bottom-right corner or wherever the user has pinned it.

3. **Hover-Expansion & Hotkey Activation:**
   - **Hover:** If the user moves their cursor over the pill, it expands slightly (like a tooltip). If they move away, it shrinks back.
   - **Hotkey Trigger (Primary Flow):** When the user presses the global hotkey (customizable in settings), the pill expands to show an audio waveform indicating it’s listening.

4. **Dictation in Progress:**
   - The user speaks; the waveform or small pulsing circle indicates active recording.
   - Audio feedback is optional (e.g., beep at start/stop).

5. **Transcription & Placement:**
   - When the user **stops** dictation (hotkey again or clicking a small “stop” button), a loading/spinner shows briefly.
   - Once the transcription is ready, it is **inserted** at the cursor’s location in whatever app or text field is currently active.

6. **Context Menu (Right-Click on Pill Icon):**
   - **Change Hotkey:** Allows the user to set a different global shortcut.
   - **Hide for 1 Hour:** Temporarily hides the on-screen pill (still runs in background).
   - **Profile (→ Website):** Opens browser to the user’s profile/subscription page, where they can see usage stats, change subscriptions, etc.

## 4. Key Features & Requirements

### 4.1 Minimal On-Screen Presence
- **Small “Pill” UI** on the desktop.
- **Hover Animation:** Slight expansion or tooltip effect.
- **Frameless/Transparent Electron Window:** Minimizes intrusion.

### 4.2 Dictation & Transcription
- **Real-Time Speech-to-Text:** Uses a high-accuracy engine (e.g., Groq whisper-turbo) for immediate transcription.
- **Loading/Spinner State:** After the user stops speaking, a quick visual indicator shows that text is processing.
- **Insert Text at Cursor:** The resulting text is automatically typed into the user’s active window.

### 4.3 Subscriptions & Usage (Web-Managed)
- **No Complex Billing in App:** All subscription tiers, billing, usage analytics, etc., appear on the **Sonic Flow website**.
- The app only checks if the user is within usage limits.

### 4.4 Settings
- **Hotkey Customization:** Provide a simple UI to reassign hotkeys.
- **Hide/Pause Options:** “Hide for 1 hour” or “Exit.”
- **Audio Feedback Toggle:** Enable/disable beep or waveform visualization.
- **Profile/Account Link:** Quick link opening user’s web dashboard.

## 5. Technology Stack & Integration

- **Electron:** For cross-platform support (Windows, Mac, Linux).
  - `BrowserWindow` with `frame: false, transparent: true` for the pill UI.
  - `Tray` or background process that keeps the app running.
  - `GlobalShortcut` for the hotkey.

- **Frontend:** 
  - Minimal React + Vite + Tailwind or similar (small footprint) for the pill interface.

- **Backend / AI Integration:**
  - Groq whisper-turbo (or equivalent). The app calls the API to get transcribed text.

- **User Authentication & Subscription:**
  - The user’s login, usage, and billing are handled **exclusively** on the web dashboard (potentially also built with React).
  - The app authenticates with tokens or stored credentials.

## 6. UI/UX Sketch

Below is a rough textual mockup:

```
 [PILL ICON]  <-- minimal pill shape
   |
   | Hover or press hotkey
   v
 [PILL EXPANDS SHOWING WAVEFORM] 
   (listening...)

   <Stop>  <-- small stop button or user presses hotkey to stop

   -> Processing... (loading spinner)
   -> Completed. (Text inserted into cursor location)
```

- **Right-Click** on pill or tray icon:
  1. Change Hotkey
  2. Hide for 1 Hour
  3. Profile (goes to web)
  4. Exit

## 7. Development & Timeline

- **Phase 1**: Basic Electron wrapper, pill UI creation, and global hotkey handling.
- **Phase 2**: Integrate real-time transcription with an API call. Insert text at cursor.
- **Phase 3**: Add hover effects, context menu items, and user preference settings. 
- **Phase 4**: Link to the web dashboard for profile/subscription management.

## 8. Summary

This simplified vision for Sonic Flow focuses on:
- **Tiny pill UI** for minimal disruption.
- **One-click or hotkey** to dictate.
- **Entire subscription & usage** is managed online.
- **Immediate text insertion** at the cursor for maximum convenience.

With these elements combined, Sonic Flow stays out of the user’s way while still providing powerful voice-to-text capabilities on demand.