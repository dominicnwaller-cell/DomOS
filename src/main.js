import { check } from '@tauri-apps/plugin-updater';

let pendingUpdate = null;
let checking = false;
let installing = false;

function setStatus(text, kind = 'normal') {
  const el = document.getElementById('updateStatus');
  if (!el) return;

  el.textContent = text;
  el.style.color =
    kind === 'good' ? '#65e6a1' :
    kind === 'bad' ? '#ff9aa2' : '';
}

function setButton(text, disabled = false) {
  const button = document.getElementById('updateButton');
  if (!button) return;

  button.textContent = text;
  button.disabled = disabled;
}

async function checkForUpdates(silent = false) {
  if (checking || installing) return;

  checking = true;

  try {
    if (!silent) {
      setStatus('Checking for updates…');
      setButton('Checking…', true);
    }

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

  } catch (error) {
    console.error('DOM.OS update check failed:', error);
    setStatus('Could not check for updates.', 'bad');
    setButton('Try again', false);

  } finally {
    checking = false;
  }
}

async function updateNow() {
  if (installing) return;

  if (!pendingUpdate) {
    await checkForUpdates(false);
    return;
  }

  installing = true;

  try {
    setButton('Downloading update…', true);
    setStatus(`Downloading DOM.OS ${pendingUpdate.version}…`);

    let downloaded = 0;
    let total = 0;

    await pendingUpdate.downloadAndInstall(event => {
      if (event.event === 'Started') {
        total = event.data.contentLength || 0;
      }

      if (event.event === 'Progress') {
        downloaded += event.data.chunkLength || 0;

        const mb = (downloaded / 1024 / 1024).toFixed(1);

        if (total) {
          const percent = Math.min(
            100,
            Math.round((downloaded / total) * 100)
          );

          setStatus(`Downloading update… ${percent}% · ${mb} MB`);
        } else {
          setStatus(`Downloading update… ${mb} MB`);
        }
      }

      if (event.event === 'Finished') {
        setStatus('Download complete. Installing update…');
      }
    });

    setStatus('Update installed. Restarting DOM.OS…', 'good');

  } catch (error) {
    console.error('DOM.OS update failed:', error);

    setStatus('Update failed. Try again.', 'bad');
    setButton('Try update again', false);

    installing = false;
  }
}

window.DOMOSUpdater = {
  checkForUpdates,
  updateNow
};

window.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('updateButton');

  if (button) {
    button.addEventListener('click', () => {
      pendingUpdate
        ? updateNow()
        : checkForUpdates(false);
    });
  }

  setTimeout(() => checkForUpdates(true), 2500);
});
