DOM.OS V6 — WINDOWS DESKTOP BUILD

This package is the V5.7 DOM.OS interface wrapped as a Tauri Windows desktop project.

ONE-TIME REQUIREMENTS ON YOUR WINDOWS PC
1. Node.js LTS
2. Rust (rustup)
3. Microsoft Visual Studio Build Tools 2022:
   select "Desktop development with C++"
4. Microsoft Edge WebView2 Runtime (normally already included with modern Windows)

THEN
1. Extract this ZIP.
2. Double-click BUILD-WINDOWS.bat.
3. When the build completes, the installer will be in:
   src-tauri\target\release\bundle\nsis
   and/or src-tauri\target\release\bundle\msi

IMPORTANT
- You only need the development tools to BUILD DOM.OS.
- The finished installed DOM.OS app does not require Python.
- This package establishes the native desktop shell first.
- The current V5.7 browser-storage behaviour is retained in this first desktop wrapper.
  SQLite/native banking integration should be added after the desktop shell has built successfully.

V6.0.1 BUILD FIX
- Removed the invalid NSIS installMode setting that blocked the Tauri Windows build.

V6.0.2 BUILD FIX
- Added the required Windows icon.ico and icon.png resources.
