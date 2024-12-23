run()

// listen to github page loaded event
document.addEventListener('pjax:end', () => run())
document.addEventListener('turbo:render', () => run())

async function run() {
  if (await repoHasChangesetsSetup()) {
    const hasChangesetFiles = await prHasChangesetFiles()
    await addChangesetsLabel(hasChangesetFiles)
  }
}

async function repoHasChangesetsSetup() {
  const orgRepo = window.location.pathname.split('/').slice(1, 3).join('/')
  const baseBranch = document
    .querySelector('.commit-ref.base-ref')
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

async function prHasChangesetFiles() {
  const orgRepo = window.location.pathname.split('/').slice(1, 3).join('/')
  const prNumber = window.location.pathname.split('/').pop()

  const cacheKey = `github-changesets-userscript:prHasChangesetFiles-${orgRepo}-${prNumber}`
  const cacheValue = sessionStorage.getItem(cacheKey)
  if (cacheValue) return cacheValue === 'true'

  const filesUrl = `https://api.github.com/repos/${orgRepo}/pulls/${prNumber}/files`
  const response = await fetch(filesUrl)
  const files = await response.json()
  const result = files.some((file) => file.filename.startsWith('.changeset/'))
  sessionStorage.setItem(cacheKey, result)
  return result
}

async function addChangesetsLabel(hasChangesets) {
  const { humanId } = await import('human-id')
  const headRef = document.querySelector('.commit-ref.head-ref').title

  const orgRepo = headRef.split(':')[0].trim()
  const branch = headRef.split(':')[1].trim()
  const prTitle = document.querySelector('.js-issue-title').textContent.trim()
  const changesetFileName = `.changeset/${humanId({
    separator: '-',
    capitalize: false,
  })}.md`
  const changesetFileContent = `\
---
@fake-scope/fake-pkg: patch
---

${prTitle}
`

  const anchor = document.createElement('a')
  anchor.textContent = hasChangesets ? 'Has changesets' : '⚠ No changesets'
  anchor.className = 'IssueLabel hx_IssueLabel mb-2 ml-2'
  // light green if has changesets, yellow if no changesets
  anchor.style.cssText = hasChangesets
    ? '--label-r:162;--label-g:239;--label-b:162;--label-h:120;--label-s:70;--label-l:78;'
    : '--label-r:239;--label-g:239;--label-b:162;--label-h:60;--label-s:70;--label-l:78;'

  // '--label-r:162;--label-g:238;--label-b:239;--label-h:180;--label-s:70;--label-l:78;'

  // prettier-ignore
  anchor.href = `https://github.com/${orgRepo}/new/${branch}?filename=${changesetFileName}&value=${encodeURIComponent(changesetFileContent)}`

  const headerMeta = document.querySelector('.gh-header-meta')
  if (headerMeta) {
    headerMeta.appendChild(anchor)
  }
}
