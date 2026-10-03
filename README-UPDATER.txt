DOM.OS V6.1 — IN-APP UPDATER FOUNDATION

This build adds:
- Settings > App Updates
- Automatic update check shortly after launch
- Check for updates button
- Download/install update from inside DOM.OS
- Signed Tauri updater artifacts
- Passive Windows updater installation
- GitHub Releases endpoint support
- GitHub Actions release workflow

ONE-TIME SETUP:
1. Create a GitHub repository for DOM.OS.
2. Run SETUP-UPDATER.bat.
3. Enter your GitHub username and repository name.
4. The script generates your permanent updater signing key locally.
5. Run BUILD-WINDOWS-UPDATER.bat.
6. Install this V6.1 build manually. This is intended to be the LAST routine manual install.

IMPORTANT:
The updater cannot work until its latest.json + signed installer are hosted at the configured HTTPS endpoint.
The included configuration uses GitHub Releases.

KEEP .domos-signing/domos.key PRIVATE AND BACK IT UP.
If that private key is lost, future builds cannot update already-installed copies signed by that key.

For fully automatic future releases, add the private key/password as GitHub Actions repository secrets and use the included release workflow.
