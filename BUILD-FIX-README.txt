DOM.OS V6.1 updater build fix

Fixed:
- Vite now treats /src as the frontend root, so src/index.html resolves.
- Vite outputs to /dist, matching the Tauri configuration.
- The updater build script now stops on errors.
- BUILD COMPLETE is only printed after a successful Tauri build.

IMPORTANT:
This ZIP does not contain your private updater signing key.
Copy the .domos-signing folder from your already-configured V6.1 folder into this new folder,
then run BUILD-WINDOWS-UPDATER.bat.

Do not regenerate the signing key.
