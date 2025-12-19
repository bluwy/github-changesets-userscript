run()

// listen to github page loaded event
document.addEventListener('pjax:end', () => run())
document.addEventListener('turbo:render', () => run())

/** @typedef {{ type: 'major' | 'minor' | 'patch', diff?: string }} PackageBumpInfo */
/** @typedef {Record<string, PackageBumpInfo[]>} UpdatedPackages */

async function run() {
  if (
    /^\/.+?\/.+?\/pull\/.+$/.exec(location.pathname) &&
    // Skip if sidebar is already added
    !hasSidebarSection() &&
    (await repoHasChangesetsSetup())
  ) {
    if (shouldRemoveChangesetBotComment) {
      removeChangesetBotComment()
    }

    const updatedPackages = await prHasChangesetFiles()
    await addChangesetSideSection(updatedPackages)
  }
}

async function repoHasChangesetsSetup() {
  const orgRepo = window.location.pathname.split('/').slice(1, 3).join('/')
  // ideally `.base-ref` should also be used, but it's not added when a pr is closed/merged
  const baseBranch = document
    .querySelector('.commit-ref')
    .title.split(':')[1]
    .trim()

  const cacheKey = `github-changesets-userscript:repoHasChangesetsSetup-${orgRepo}-${baseBranch}`
  const cacheValue = sessionStorage.getItem(cacheKey)
  if (!shouldSkipCache && cacheValue) return cacheValue === 'true'

  const changesetsFolderUrl = `https://github.com/${orgRepo}/tree/${baseBranch}/.changeset`
  const response = await fetch(changesetsFolderUrl, { method: 'HEAD' })
  const result = response.status === 200
  sessionStorage.setItem(cacheKey, result)
  return result
}

/**
 * @returns {Promise<UpdatedPackages>} packages to be bumped
 */
async function prHasChangesetFiles() {
  const orgRepo = window.location.pathname.split('/').slice(1, 3).join('/')
  const prNumber = window.location.pathname.split('/').pop()

  // get pr commit sha for cache key
  const allCommitTimeline = document.querySelectorAll(
    '.js-timeline-item:has(svg.octicon-git-commit) a.markdown-title'
  )
  const prCommitSha = allCommitTimeline[allCommitTimeline.length - 1].href
    .split('/')
    .slice(-1)
    .join('')
    .slice(0, 7)

  const cacheKey = `github-changesets-userscript:prHasChangesetFiles-${orgRepo}-${prNumber}-${prCommitSha}`
  const cacheValue = sessionStorage.getItem(cacheKey)
  if (!shouldSkipCache && cacheValue) return JSON.parse(cacheValue)

  const filesUrl = `https://api.github.com/repos/${orgRepo}/pulls/${prNumber}/files`
  const response = await fetch(filesUrl)
  const files = await response.json()
  const hasChangesetFiles = files.some((file) =>
    file.filename.startsWith('.changeset/')
  )
  if (hasChangesetFiles) {
    const updatedPackages = await getUpdatedPackagesFromAddedChangedFiles(files)
    sessionStorage.setItem(cacheKey, JSON.stringify(updatedPackages))
    return updatedPackages
  } else {
    sessionStorage.setItem(cacheKey, '{}')
    return {}
  }
}

/**
 * @param {UpdatedPackages} updatedPackages
 */
async function addChangesetSideSection(updatedPackages) {
  const { humanId } = await import('human-id')
  updatedPackages = sortUpdatedPackages(updatedPackages)
  const headRef = document.querySelector('.commit-ref.head-ref > a').title

  const orgRepo = headRef.split(':')[0].trim()
  const branch = headRef.split(':')[1].trim()
  const prTitle = document.querySelector('.js-issue-title').textContent.trim()
  const changesetFileName = `.changeset/${humanId({
    separator: '-',
    capitalize: false,
  })}.md`
  // NOTE: it's possible to fetch the git tree and figure out the possible package names
  // based on the PR diff for the default frontmatter, but it's a lot of work, code, and
  // bandwidth to acheive a small QoL improvement. So, skip that for now.
  const changesetFileContent = `\
---
"package": patch
---

${prTitle}
`

  const canEditPr = !!document.querySelector('button.js-title-edit-button')
  const isPrOpen = !!document.querySelector('.gh-header .State.State--open')
  const notificationsSideSection = document.querySelector(
    '.discussion-sidebar-item.sidebar-notifications'
  )
  const plusIcon = `<svg class="octicon octicon-plus" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"></path></svg>`

  // add new section just before the notifications section
  let html =
    canEditPr && isPrOpen
      ? `<a class="d-block text-bold discussion-sidebar-heading discussion-sidebar-toggle" href="https://github.com/${orgRepo}/new/${branch}?filename=${changesetFileName}&value=${encodeURIComponent(
          changesetFileContent
        )}">Changesets\n${plusIcon}</a>`
      : `<div class="d-block text-bold discussion-sidebar-heading">Changesets</div>`
  if (Object.keys(updatedPackages).length) {
    html += `\
<table style="width: 100%; max-width: 400px;">
  <tbody>
    ${Object.entries(updatedPackages)
      .map(([pkg, bumpInfos]) => {
        const bumpElements = bumpInfos.map((info) => {
          if (info.diff) {
            return `<a class="Link--muted" href="${
              location.origin + location.pathname
            }/files#diff-${info.diff}">${info.type}</a>`
          } else {
            return info.type
          }
        })

        return `\
<tr>
  <td style="width: 1px; white-space: nowrap; padding-right: 8px; vertical-align: top;">${pkg}</td>
  <td class="color-fg-muted">${bumpElements.join(', ')}</td>
</tr>`
      })
      .join('')}
  </tbody>  
</table>`
  }

  // Check one last time if the sidebar section already exist, we already check in `run()`, but
  // sometimes GitHub can trigger reruns multiple times causing this to be called multiple times too
  if (hasSidebarSection()) return
  const changesetSideSection = document.createElement('div')
  changesetSideSection.className = 'discussion-sidebar-item sidebar-changesets'
  changesetSideSection.innerHTML = html
  notificationsSideSection.before(changesetSideSection)
}

function hasSidebarSection() {
  return !!document.querySelector('.sidebar-changesets')
}

function removeChangesetBotComment() {
  const changesetBotComment = document.querySelector(
    '.js-timeline-item:has(a.author[href="/apps/changeset-bot"])'
  )
  if (changesetBotComment) {
    changesetBotComment.remove()
  }
}

/**
 * @param {{ filename: string, status: string, patch: string }[]} changedFiles
 */
async function getUpdatedPackagesFromAddedChangedFiles(changedFiles) {
  /** @type {UpdatedPackages} */
  const map = {}
  for (const file of changedFiles) {
    if (file.filename.startsWith('.changeset/') && file.status === 'added') {
      const lines = parseAddedPatchStringAsLines(file.patch)

      let isInYaml = false
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line === '---') {
          isInYaml = !isInYaml
          if (isInYaml) continue
          else break
        }

        const match = /^['"](.+?)['"]:\s*(major|minor|patch)\s*$/.exec(line)
        if (!match) continue
        const pkg = match[1]
        const type = /** @type {PackageBumpInfo['type']} */ match[2]
        const diff = await getAddedDiff(file.filename, i + 1)
        const packages = map[pkg] || []
        packages.push({ type, diff })
        map[pkg] = packages
      }
    }
  }
  return map
}

/**
 * @param {string} patch
 */
function parseAddedPatchStringAsLines(patch) {
  return patch
    .replace(/^@@.*?@@$\n/m, '') // remove leading "@@ -0,0 +1,5 @@" annotation
    .replace(/^\+/gm, '') // remove leading "+"
    .split('\n')
}

/**
 * @param {string} filename
 * @param {number} line 1-based
 */
async function getAddedDiff(filename, line) {
  if (window.isSecureContext && window.crypto && window.crypto.subtle) {
    // how to get the diff link: https://github.com/orgs/community/discussions/55764
    const filenameSha256 = await sha256(filename)
    return `${filenameSha256}R${line}`
  }
}

/**
 * @param {string} message
 */
async function sha256(message) {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * @param {UpdatedPackages} map
 * @return {UpdatedPackages}
 */
function sortUpdatedPackages(map) {
  /** @type {UpdatedPackages} */
  const newMap = {}
  for (const key of Object.keys(map).sort()) {
    // Sort major, then minor, then patch
    const order = { major: 1, minor: 2, patch: 3 }
    const value = [...map[key]].sort((a, b) => {
      return order[a.type] - order[b.type]
    })
    newMap[key] = value
  }
  return newMap
}
