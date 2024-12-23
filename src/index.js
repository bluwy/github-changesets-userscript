run()

// listen to github page loaded event
document.addEventListener('pjax:end', () => run())
document.addEventListener('turbo:render', () => run())

/** @typedef {Record<string, ('major' | 'minor' | 'patch')[]>} UpdatedPackages */

async function run() {
  if (
    /^\/.+?\/.+?\/pull\/.+$/.exec(location.pathname) &&
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
  if (cacheValue) return cacheValue === 'true'

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
  if (cacheValue) return JSON.parse(cacheValue)

  const filesUrl = `https://api.github.com/repos/${orgRepo}/pulls/${prNumber}/files`
  const response = await fetch(filesUrl)
  const files = await response.json()
  const hasChangesetFiles = files.some((file) =>
    file.filename.startsWith('.changeset/')
  )
  if (hasChangesetFiles) {
    const updatedPackages = getUpdatedPackagesFromAddedChangedFiles(files)
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
  // if already added, return
  if (document.querySelector('.sidebar-changesets')) return

  const { humanId } = await import('human-id')
  const headRef = document.querySelector('.commit-ref.head-ref').title

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
package: patch
---

${prTitle}
`

  const canEditPr = !!document.querySelector('button.js-title-edit-button')
  const isPrOpen = !!document.querySelector('.State.State--open')
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
      .map(
        ([pkg, bumps]) =>
          `<tr><td style="width: 1px; white-space: nowrap; padding-right: 8px;">${pkg}</td><td class="color-fg-muted">${bumps.join(
            ', '
          )}</td></tr>`
      )
      .join('')}
  </tbody>  
</table>`
  }

  const changesetSideSection = document.createElement('div')
  changesetSideSection.className = 'discussion-sidebar-item sidebar-changesets'
  changesetSideSection.innerHTML = html
  notificationsSideSection.before(changesetSideSection)
}

function removeChangesetBotComment() {
  const changesetBotComment = document.querySelector(
    '.js-timeline-item:has(a.author[href="/apps/changeset-bot"])'
  )
  if (changesetBotComment) {
    changesetBotComment.remove()
  }
}

// TODO: validate if not match major/minor/patch
function getUpdatedPackagesFromAddedChangedFiles(changedFiles) {
  /** @type {UpdatedPackages} */
  const map = {}
  for (const file of changedFiles) {
    if (file.filename.startsWith('.changeset/') && file.status === 'added') {
      const yaml = /---.+---/s.exec(file.patch)?.[0]
      if (!yaml) continue
      const matched = yaml.matchAll(/\+(.+?):\s*(major|minor|patch)\n/g)
      for (const match of matched) {
        const pkg = match[1].replace(/^['"]|['"]$/g, '')
        const bump = match[2]
        const packages = map[pkg] || []
        packages.push(bump)
        map[pkg] = packages
      }
    }
  }
  return map
}
