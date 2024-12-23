import fs from 'node:fs/promises'
import fss from 'node:fs'
import path from 'node:path'
import * as esbuild from 'esbuild'

// Change this if needed
const directOutfile =
  '/Users/bjorn/Library/Containers/com.userscripts.macos.Userscripts-Extension/Data/Documents/scripts/GitHub Changesets (Local).user.js'

const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'))
const isWatch = process.argv.includes('--watch')
const isDirect = process.argv.includes('--direct')

if (isDirect && !fss.existsSync(path.dirname(directOutfile))) {
  throw new Error(
    'The directory of `directOutFile` does not exist. Did you forgot to update it for your machine?'
  )
}

const ctx = await esbuild[isWatch ? 'context' : 'build']({
  entryPoints: ['src/index.js'],
  outfile: isDirect ? directOutfile : 'dist/github-changesets.user.js',
  bundle: true,
  format: 'iife',
  logLevel: 'info',
  banner: {
    js: `\
// ==UserScript==
// @name         GitHub Changesets${isDirect ? ' (Local)' : ''}
// @license      MIT
// @homepageURL  https://github.com/bluwy/github-changesets-userscript
// @supportURL   https://github.com/bluwy/github-changesets-userscript
// @namespace    https://greasyfork.org/
// @version      ${pkg.version}
// @description  Improve your Changesets experience in GitHub PRs
// @author       Bjorn Lu
// @match        https://github.com/**
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @grant        none
// ==/UserScript==

// Options
const shouldRemoveChangesetBotComment = true

;`,
  },
})

if (isWatch) {
  await ctx.watch()
}
