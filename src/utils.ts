export function getBaseRef() {
  const ownerRepo = getOwnerRepo()

  // Old UI
  const oldBranch = document.querySelector<HTMLElement>('.commit-ref')?.title?.split(':')[1]?.trim()
  if (oldBranch) {
    return { ownerRepo, branch: oldBranch }
  }

  // New UI
  const el = document.querySelector(
    `[class*=PullRequestHeaderSummary] a[href^="/${ownerRepo}/tree/"]`,
  )
  const branch = el?.getAttribute('href')!.split('/tree/')[1]
  if (!branch) return null
  return { ownerRepo, branch }
}

export function getHeadRef() {
  // Old UI
  const oldHeadRefTitle = document.querySelector<HTMLElement>('.commit-ref.head-ref > a')?.title
  if (oldHeadRefTitle) {
    const splitted = oldHeadRefTitle.split(':')
    return {
      ownerRepo: splitted[0].trim(),
      branch: splitted[1].trim(),
    }
  }

  // New UI
  const el = document.querySelectorAll(`[class*=PullRequestHeaderSummary] a[href*="/tree/"]`)[1]
  if (!el) return null
  const splitted = el.getAttribute('href')!.split('/tree/')
  const ownerRepo = splitted[0].slice(1) // remove starting slash
  const branch = splitted[1]
  if (!branch) return null
  return { ownerRepo, branch }
}

export function canEditPr() {
  // Old UI
  if (document.querySelector('button.js-title-edit-button')) return true

  // New UI
  return document
    .querySelector('[class*="prc-PageHeader-Actions"] button')
    ?.textContent?.includes('Edit')
}

export function isPrOpen() {
  // Old UI
  if (document.querySelector('.gh-header .State.State--open')) return true

  // New UI
  return !!document.querySelector(
    '[class*="prc-PageHeader-Description"] [class*="prc-StateLabel-StateLabel"][data-status="pullOpened"]',
  )
}

function getOwnerRepo() {
  return window.location.pathname.split('/').slice(1, 3).join('/')
}
