// Run with a Playwright installation; set PLAYWRIGHT_MODULE_PATH if it lives outside this repo.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { _electron: electron } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')

;(async () => {
  const root = path.resolve(__dirname, '..')
  const packaged = process.env.WRITING_ASSISTANT_EXECUTABLE
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'writing-assistant-check-'))
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({
    executablePath: packaged || path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: [...(packaged ? [] : [root]), `--user-data-dir=${profile}`],
    env
  })
  try {
    const page = await app.firstWindow()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text().slice(0, 500))
    })
    await page.getByRole('button', { name: 'Try an example' }).click()
    await page.locator('.card').first().waitFor()
    const originalCount = await page.locator('.card').count()
    assert.ok(originalCount >= 2, 'Embedded grammar engine must detect the sample misspellings')
    const spellingCard = page.locator('.card').filter({ has: page.locator('.prev-old', { hasText: /^speling$/ }) })
    await spellingCard.getByRole('button', { name: 'Accept', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.cm-content').textContent.includes('spelling'))
    await page.waitForFunction(count => document.querySelectorAll('.card').length < count, originalCount)
    const beforeDismiss = await page.locator('.card').count()
    const textBeforeDismiss = await page.locator('.cm-content').innerText()
    await page.locator('.card').first().getByRole('button', { name: 'Dismiss', exact: true }).click()
    await page.waitForFunction(count => document.querySelectorAll('.card').length < count, beforeDismiss)
    assert.equal(await page.locator('.cm-content').innerText(), textBeforeDismiss)
    await page.waitForTimeout(650)
    await page.reload()
    await page.waitForFunction(text => document.querySelector('.cm-content')?.textContent === text, textBeforeDismiss)
    await page.waitForTimeout(800)
    assert.equal(await page.locator('.card').count(), beforeDismiss - 1, 'Dismissal should survive reload')
    await page.getByRole('button', { name: 'Goals' }).click()
    await page.locator('.goals-panel').waitFor()
    await page.locator('.goals-x').click()
    const qaDir = path.join(root, 'qa')
    fs.mkdirSync(qaDir, { recursive: true })
    await page.screenshot({ path: path.join(qaDir, 'writing-app-verified.png') })
    assert.deepEqual(errors, [], 'The normal writing flow must have no renderer errors')

    // Simulate the original failure: WASM cannot instantiate. The user must not see a false 100.
    await page.addInitScript(() => {
      WebAssembly.instantiate = async () => { throw new Error('Simulated unavailable grammar engine') }
      WebAssembly.instantiateStreaming = async () => { throw new Error('Simulated unavailable grammar engine') }
    })
    await page.reload()
    await page.getByRole('alert').waitFor()
    await page.getByRole('heading', { name: 'Checker unavailable' }).waitFor()
    assert.equal(await page.getByText('Overall score', { exact: true }).count(), 0)
    console.log(JSON.stringify({ result: 'PASS', target: packaged || 'built development app', checks: [
      'Try an example loads sample text', 'Real embedded WASM detects spelling errors',
      'Accept changes the intended word', 'Dismiss preserves text', 'Document and dismissal persist',
      'Goals opens', 'Normal flow has no renderer errors', 'Engine failure displays an error without a false score'
    ], profile }, null, 2))
  } finally {
    await app.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
