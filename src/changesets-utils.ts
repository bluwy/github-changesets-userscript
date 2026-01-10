export type BumpType = 'major' | 'minor' | 'patch'

export interface PackageBumpInfo {
  type: BumpType
  diff?: string
}

export type UpdatedPackages = Record<string, PackageBumpInfo[]>

interface GitHubFile {
  filename: string
  status: string
  patch: string
}

export async function repoHasChangesetsSetup() {
  const orgRepo = window.location.pathname.split('/').slice(1, 3).join('/')
  // ideally `.base-ref` should also be used, but it's not added when a pr is closed/merged
  const baseBranch = document.querySelector<HTMLElement>('.commit-ref')?.title.split(':')[1].trim()
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

export async function getUpdatedPackages(): Promise<UpdatedPackages> {
  const orgRepo = window.location.pathname.split('/').slice(1, 3).join('/')
  const prNumber = window.location.pathname.split('/').pop()

  // get pr commit sha for cache key
  const allCommitTimeline = document.querySelectorAll<HTMLAnchorElement>(
    '.js-timeline-item:has(svg.octicon-git-commit) a.markdown-title',
  )
  const prCommitSha = allCommitTimeline[allCommitTimeline.length - 1].href
    .split('/')
    .slice(-1)
    .join('')
    .slice(0, 7)

  const cacheKey = `github-changesets-userscript:getUpdatedPackages-${orgRepo}-${prNumber}-${prCommitSha}`
  const cacheValue = sessionStorage.getItem(cacheKey)
  if (!shouldSkipCache && cacheValue) return JSON.parse(cacheValue)

  const filesUrl = `https://api.github.com/repos/${orgRepo}/pulls/${prNumber}/files`
  const response = await fetch(filesUrl)
  const files: GitHubFile[] = await response.json()
  const hasChangesetFiles = files.some((file) => file.filename.startsWith('.changeset/'))
  if (hasChangesetFiles) {
    const updatedPackages = await getUpdatedPackagesFromAddedChangedFiles(files)
    sessionStorage.setItem(cacheKey, JSON.stringify(updatedPackages))
    return updatedPackages
  } else {
    sessionStorage.setItem(cacheKey, '{}')
    return {}
  }
}

async function getUpdatedPackagesFromAddedChangedFiles(changedFiles: GitHubFile[]) {
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

// Implement temporary cache as the function may be called multiple times on the page
const createChangesetLinkCache: Record<string, string> = {}

export async function getCreateChangesetLink() {
  const canEditPr = !!document.querySelector('button.js-title-edit-button')
  const isPrOpen = !!document.querySelector('.gh-header .State.State--open')
  // No longer possible to create changeset
  if (!canEditPr || !isPrOpen) {
    return null
  }

  const headRef = document.querySelector<HTMLElement>('.commit-ref.head-ref > a')?.title
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

// Branch name may have `#` which interferes with the URL. Replace it away.
// No need for complete `encodeURI` as the browser can handle it automatically.
function encodeGitHubURI(uri: string) {
  return uri.replace('#', '%23')
}
