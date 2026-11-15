const { readFile } = require('node:fs/promises');
const { setTimeout: delay } = require('node:timers/promises');

async function waitForDevToolsPort(portFile, child) {
  let launchError;
  const onError = error => { launchError = error; };
  child.on('error', onError);
  const deadline = Date.now() + 15000;
  try {
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (child.exitCode !== null || child.signalCode !== null) {
        throw Error('Chromium exited before publishing its DevTools port');
      }
      let marker = '';
      try {
        marker = await readFile(portFile, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      // Chromium can create the marker before writing its contents.
      const port = marker.match(/^([1-9]\d{0,4})\r?\n/)?.[1];
      if (port && Number(port) <= 65535) return port;
      await delay(25);
    }
    throw Error('Chromium did not publish a complete DevTools port marker');
  } finally {
    child.off('error', onError);
  }
}

module.exports = { waitForDevToolsPort };
