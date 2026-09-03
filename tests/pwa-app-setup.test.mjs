import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const manifestPath = new URL('../app/manifest.ts', import.meta.url)
const layoutPath = new URL('../app/layout.tsx', import.meta.url)
const launchPath = new URL('../app/launch/page.tsx', import.meta.url)
const bootstrapPath = new URL('../components/pwa/BearFitPwaBootstrap.tsx', import.meta.url)
const swPath = new URL('../public/sw.js', import.meta.url)
const signinPath = new URL('../app/api/auth/signin/route.ts', import.meta.url)
const signupPath = new URL('../app/api/auth/signup/route.ts', import.meta.url)
const confirmPath = new URL('../app/auth/confirm/route.ts', import.meta.url)

test('BearFit uses one canonical role-aware install manifest', () => {
  assert.equal(fs.existsSync(manifestPath), true)
  const manifest = fs.readFileSync(manifestPath, 'utf8')

  assert.match(manifest, /name:\s*["']BearFit["']/)
  assert.match(manifest, /short_name:\s*["']BearFit["']/)
  assert.match(manifest, /start_url:\s*["']\/launch\?source=pwa["']/)
  assert.match(manifest, /display:\s*["']standalone["']/)
  assert.match(manifest, /theme_color:\s*["']#F37120["']/i)
  assert.match(manifest, /icon-192\.png/)
  assert.match(manifest, /icon-512\.png/)
  assert.match(manifest, /icon-maskable-512\.png/)
  assert.match(manifest, /purpose:\s*["']maskable["']/)

  assert.equal(fs.existsSync(new URL('../public/manifest.json', import.meta.url)), false)
})

test('root layout exposes Apple/PWA metadata and boots the client PWA helper', () => {
  const layout = fs.readFileSync(layoutPath, 'utf8')
  assert.match(layout, /manifest:\s*["']\/manifest\.webmanifest["']/)
  assert.match(layout, /appleWebApp/)
  assert.match(layout, /apple-touch-icon\.png/)
  assert.match(layout, /viewportFit:\s*["']cover["']/)
  assert.match(layout, /themeColor:\s*["']#F37120["']/i)
  assert.match(layout, /BearFitPwaBootstrap/)
})

test('PWA launch route sends each signed-in role to the correct app surface', () => {
  assert.equal(fs.existsSync(launchPath), true)
  const launch = fs.readFileSync(launchPath, 'utf8')
  assert.match(launch, /auth\.getUser\(\)/)
  assert.match(launch, /profiles/)
  assert.match(launch, /role\s*===\s*["']admin["']/)
  assert.match(launch, /role\s*===\s*["']staff["']/)
  assert.match(launch, /redirect\(["']\/staff\/schedule["']\)/)
  assert.match(launch, /redirect\(["']\/member\/dashboard["']\)/)
  assert.match(launch, /redirect\(["']\/login\?source=pwa["']\)/)
})

test('auth completion paths funnel through the role-aware launch route', () => {
  const signin = fs.readFileSync(signinPath, 'utf8')
  const signup = fs.readFileSync(signupPath, 'utf8')
  const confirm = fs.readFileSync(confirmPath, 'utf8')

  assert.match(signin, /redirectTo:\s*["']\/launch["']/)
  assert.match(signup, /redirectTo:\s*requiresEmailConfirmation\s*\?\s*["']\/login["']\s*:\s*["']\/launch["']/)
  assert.match(confirm, /pathname\s*=\s*["']\/launch["']/)
})

test('service worker caches only static app assets and never private API/navigation responses', () => {
  assert.equal(fs.existsSync(swPath), true)
  const sw = fs.readFileSync(swPath, 'utf8')
  assert.match(sw, /bearfit-static-/)
  assert.match(sw, /\/_next\/static\//)
  assert.match(sw, /\/icons\/icon-192\.png/)
  assert.match(sw, /\/icons\/icon-512\.png/)
  assert.match(sw, /request\.mode\s*===\s*["']navigate["']/)
  assert.match(sw, /pathname\.startsWith\(["']\/api\/["']\)/)
  assert.match(sw, /pathname\.startsWith\(["']\/auth\/["']\)/)
  assert.match(sw, /return fetch\(request\)/)
  assert.doesNotMatch(sw, /caches\.put\([^\n]*request[^\n]*\)[\s\S]{0,120}pathname\.startsWith\(["']\/api\//)
})

test('PWA bootstrap registers the worker and exposes an install button only when supported', () => {
  assert.equal(fs.existsSync(bootstrapPath), true)
  const bootstrap = fs.readFileSync(bootstrapPath, 'utf8')
  assert.match(bootstrap, /navigator\.serviceWorker\.register\(["']\/sw\.js["']\)/)
  assert.match(bootstrap, /beforeinstallprompt/)
  assert.match(bootstrap, /display-mode:\s*standalone/)
  assert.match(bootstrap, /Install BearFit/)
  assert.match(bootstrap, /\.prompt\(\)/)
})

function pngDimensions(url) {
  const buffer = fs.readFileSync(url)
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

test('PWA-specific icon files exist at their declared dimensions', () => {
  const icons = [
    ['../public/icons/icon-192.png', 192],
    ['../public/icons/icon-512.png', 512],
    ['../public/icons/icon-maskable-512.png', 512],
    ['../public/icons/apple-touch-icon.png', 180],
  ]

  for (const [file, size] of icons) {
    const url = new URL(file, import.meta.url)
    assert.equal(fs.existsSync(url), true, `${file} should exist`)
    assert.deepEqual(pngDimensions(url), { width: size, height: size })
  }
})
