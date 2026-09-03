import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const manifestPath = new URL('../app/manifest.ts', import.meta.url)
const layoutPath = new URL('../app/layout.tsx', import.meta.url)
const swPath = new URL('../public/sw.js', import.meta.url)

function pngDimensions(url) {
  const buffer = fs.readFileSync(url)
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

test('PWA launch branding uses BearFit orange and versioned orange logo icons', () => {
  const manifest = fs.readFileSync(manifestPath, 'utf8')
  const layout = fs.readFileSync(layoutPath, 'utf8')
  const sw = fs.readFileSync(swPath, 'utf8')

  assert.match(manifest, /background_color:\s*["']#F37020["']/i)
  assert.match(manifest, /theme_color:\s*["']#F37020["']/i)
  assert.match(layout, /themeColor:\s*["']#F37020["']/i)
  assert.match(manifest, /bearfit-orange-192\.png/)
  assert.match(manifest, /bearfit-orange-512\.png/)
  assert.match(manifest, /bearfit-orange-maskable-512\.png/)
  assert.match(layout, /bearfit-orange-apple-180\.png/)
  assert.match(sw, /bearfit-static-v2/)
  assert.match(sw, /bearfit-orange-192\.png/)
  assert.match(sw, /bearfit-orange-512\.png/)
  assert.match(sw, /bearfit-orange-maskable-512\.png/)
  assert.match(sw, /bearfit-orange-apple-180\.png/)
})

test('new BearFit orange icon files exist at installable app dimensions', () => {
  const icons = [
    ['../public/icons/bearfit-orange-192.png', 192],
    ['../public/icons/bearfit-orange-512.png', 512],
    ['../public/icons/bearfit-orange-maskable-512.png', 512],
    ['../public/icons/bearfit-orange-apple-180.png', 180],
  ]

  for (const [file, size] of icons) {
    const url = new URL(file, import.meta.url)
    assert.equal(fs.existsSync(url), true, `${file} should exist`)
    assert.deepEqual(pngDimensions(url), { width: size, height: size })
  }
})
