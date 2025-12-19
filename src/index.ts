run()

// listen to github page loaded event
document.addEventListener('pjax:end', () => run())
document.addEventListener('turbo:render', () => run())

type BumpType = 'major' | 'minor' | 'patch'

interface PackageBumpInfo {
  type: BumpType
  diff?: string
}

type UpdatedPackages = Record<string, PackageBumpInfo[]>

interface GitHubFile {
  filename: string
  status: string
  patch: string
}

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
    await addChangesetMergeWarning(updatedPackages)
  }
}

async function repoHasChangesetsSetup() {
  const orgRepo = window.location.pathname.split('/').slice(1, 3).join('/')
  // ideally `.base-ref` should also be used, but it's not added when a pr is closed/merged
  const baseBranch = document
    .querySelector<HTMLElement>('.commit-ref')
    ?.title.split(':')[1]
    .trim()
  if (!baseBranch) return false

  const cacheKey = `github-changesets-userscript:repoHasChangesetsSetup-${orgRepo}-${baseBranch}`
  const cacheValue = sessionStorage.getItem(cacheKey)
  if (!shouldSkipCache && cacheValue) return cacheValue === 'true'

  const encodedBaseBranch = encodeGitHubURI(baseBranch)
  const changesetsFolderUrl = `https://github.com/${orgRepo}/tree/${encodedBaseBranch}/.changeset`
  const response = await fetch(changesetsFolderUrl, { method: 'HEAD' })
  const result = response.status === 200
  sessionStorage.setItem(cacheKey, result + '')
  return result
}

/**
 * @returns packages to be bumped
 */
async function prHasChangesetFiles(): Promise<UpdatedPackages> {
  const orgRepo = window.location.pathname.split('/').slice(1, 3).join('/')
  const prNumber = window.location.pathname.split('/').pop()

  // get pr commit sha for cache key
  const allCommitTimeline = document.querySelectorAll<HTMLAnchorElement>(
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
  const files: GitHubFile[] = await response.json()
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

async function addChangesetSideSection(updatedPackages: UpdatedPackages) {
  updatedPackages = sortUpdatedPackages(updatedPackages)

  const notificationsSideSection = document.querySelector(
    '.discussion-sidebar-item.sidebar-notifications'
  )
  if (!notificationsSideSection) return
  const plusIcon = `<svg class="octicon octicon-plus" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"></path></svg>`
  const createLink = await getCreateChangesetLink()

  // add new section just before the notifications section
  let html = createLink
    ? `<a class="d-block text-bold discussion-sidebar-heading discussion-sidebar-toggle" href="${createLink}">Changesets\n${plusIcon}</a>`
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

async function addChangesetMergeWarning(updatedPackages: UpdatedPackages) {
  if (Object.keys(updatedPackages).length > 0) return
  if (hasChangesetMergeWarning()) return

  const createLink = await getCreateChangesetLink()
  if (!createLink) return

  const warning = document.createElement('span')
  const warningIcon = `<svg class="octicon octicon-alert mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>`

  // These styles are beyond disgusting, sorry not sorry
  warning.className =
    'warning-changesets d-block position-absolute fgColor-attention text-small ml-md-6 pl-md-4 pl-1'
  warning.style.marginTop = '-2.6rem'
  warning.innerHTML = `\
    ${warningIcon}
    <span>No changesets found.</span>
    <a class="Link--muted Link--inTextBlock" href="${createLink}">Create new</a>
  `

  const mergeBox = document.querySelector('.merge-pr')
  if (!mergeBox) return

  if (hasChangesetMergeWarning()) return
  mergeBox.insertAdjacentElement('afterend', warning)
}

function hasChangesetMergeWarning() {
  return !!document.querySelector('.warning-changesets')
}

// Implement temporary cache as the function may be called multiple times on the page
const createChangesetLinkCache: Record<string, string> = {}

async function getCreateChangesetLink() {
  const canEditPr = !!document.querySelector('button.js-title-edit-button')
  const isPrOpen = !!document.querySelector('.gh-header .State.State--open')
  // No longer possible to create changeset
  if (!canEditPr || !isPrOpen) {
    return null
  }

  const headRef = document.querySelector<HTMLElement>(
    '.commit-ref.head-ref > a'
  )?.title
  if (!headRef) return null
  const orgRepo = headRef.split(':')[0].trim()
  const branch = headRef.split(':')[1].trim()
  const prTitle = document.querySelector('.js-issue-title')?.textContent.trim()

  const key = `${orgRepo}-${branch}`
  if (createChangesetLinkCache[key]) {
    return createChangesetLinkCache[key]
  }

  const { humanId } = await import('human-id')
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

  const encodedBranch = encodeGitHubURI(branch)
  const encodedContent = encodeURIComponent(changesetFileContent)
  const link = `https://github.com/${orgRepo}/new/${encodedBranch}?filename=${changesetFileName}&value=${encodedContent}`
  createChangesetLinkCache[key] = link
  return link
}

async function getUpdatedPackagesFromAddedChangedFiles(
  changedFiles: GitHubFile[]
) {
  const map: UpdatedPackages = {}
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
        const type = match[2] as BumpType
        const diff = await getAddedDiff(file.filename, i + 1)
        const packages = map[pkg] || []
        packages.push({ type, diff })
        map[pkg] = packages
      }
    }
  }
  return map
}

function parseAddedPatchStringAsLines(patch: string) {
  return patch
    .replace(/^@@.*?@@$\n/m, '') // remove leading "@@ -0,0 +1,5 @@" annotation
    .replace(/^\+/gm, '') // remove leading "+"
    .split('\n')
}

/**
 * @param filename
 * @param line 1-based
 */
async function getAddedDiff(filename: string, line: number) {
  if (window.isSecureContext && window.crypto && window.crypto.subtle) {
    // how to get the diff link: https://github.com/orgs/community/discussions/55764
    const filenameSha256 = await sha256(filename)
    return `${filenameSha256}R${line}`
  }
}

async function sha256(message: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

function sortUpdatedPackages(map: UpdatedPackages): UpdatedPackages {
  const newMap: UpdatedPackages = {}
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

// Branch name may have `#` which interferes with the URL. Replace it away.
// No need for complete `encodeURI` as the browser can handle it automatically.
function encodeGitHubURI(uri: string) {
  return uri.replace('#', '%23')
}
