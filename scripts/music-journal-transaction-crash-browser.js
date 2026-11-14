// Start SIGKILL only after the real write request succeeds and before its
// transaction can commit. Chained reads keep that specific transaction open.
async function killDuringWrite(page, child, storeName, operation) {
  let writeReached;
  const writing = new Promise(resolve => { writeReached = resolve; });
  await page.exposeBinding('novaWriteReached', writeReached);
  await page.evaluate(name => {
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (value, ...args) {
      const request = add.call(this, value, ...args);
      if (this.name === name) {
        IDBObjectStore.prototype.add = add;
        request.addEventListener('success', () => {
          const hold = () => this.get(request.result).addEventListener('success', hold, { once: true });
          hold();
          window.novaWriteReached();
        }, { once: true });
      }
      return request;
    };
  }, storeName);
  const completed = operation();
  let timer;
  try {
    await Promise.race([
      writing,
      completed.then(result => { throw Error('operation-ended-before-write: ' + JSON.stringify(result)); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('write-boundary-timeout')), 45000); })
    ]);
  } finally {
    clearTimeout(timer);
  }
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGKILL');
  const [, signal] = await exited;
  if (signal !== 'SIGKILL') throw Error('expected-chromium-sigkill');
  await completed.catch(() => {});
}

module.exports = { killDuringWrite };
