import { check } from '@tauri-apps/plugin-updater';

let pendingUpdate = null;

function setStatus(text, kind='normal') {
  const el = document.getElementById('updateStatus');
  if (!el) return;
  el.textContent = text;
  el.style.color = kind === 'good' ? '#65e6a1' : kind === 'bad' ? '#ff9aa2' : '';
}
function setButton(text, disabled=false) {
  const b = document.getElementById('updateButton');
  if (!b) return;
  b.textContent = text;
  b.disabled = disabled;
}
async function checkForUpdates(silent=false) {
  try {
    if (!silent) { setStatus('Checking for updates…'); setButton('Checking…', true); }
    const update = await check();
    if (!update) {
      pendingUpdate = null;
      setStatus('DOM.OS is up to date.', 'good');
      setButton('Check for updates', false);
      return;
    }
    pendingUpdate = update;
    setStatus(`Version ${update.version} is available.`);
    setButton(`Update to ${update.version}`, false);
  } catch (e) {
    console.error(e);
    setStatus('Could not check for updates.', 'bad');
    setButton('Try again', false);
  }
}
async function updateNow() {
  if (!pendingUpdate) return checkForUpdates(false);
  try {
    setButton('Downloading update…', true);
    setStatus(`Downloading DOM.OS ${pendingUpdate.version}…`);
    let downloaded = 0;
    await pendingUpdate.downloadAndInstall((event) => {
      if (event.event === 'Progress') {
        downloaded += event.data.chunkLength || 0;
        setStatus(`Downloading update… ${(downloaded/1024/1024).toFixed(1)} MB`);
      } else if (event.event === 'Finished') {
        setStatus('Installing update… DOM.OS will restart.');
      }
    });
  } catch (e) {
    console.error(e);
    setStatus('Update failed. Try again.', 'bad');
    setButton('Try update again', false);
  }
}
window.DOMOSUpdater = { checkForUpdates, updateNow };
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('updateButton')?.addEventListener('click', () => pendingUpdate ? updateNow() : checkForUpdates(false));
  setTimeout(() => checkForUpdates(true), 2500);
});
