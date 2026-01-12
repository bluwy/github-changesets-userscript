import { getCreateChangesetLink, type UpdatedPackages } from '../changesets-utils.ts'

export async function addMergeWarning(updatedPackages: UpdatedPackages) {
  if (Object.keys(updatedPackages).length > 0) return
  if (isReleasePr()) return
  if (hasChangesetMergeWarning()) return

  const createLink = await getCreateChangesetLink()
  if (!createLink) return

  const warning = document.createElement('span')
  const warningIcon = `<svg class="octicon octicon-alert mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>`

  // The warning is added after the merge box because it's a React component that gets updated, and
  // may re-render and remove our added element. So we use position absolute to place it visually
  // under the merge box as if it's part of it.
  warning.className =
    'warning-changesets position-absolute fgColor-attention text-small ml-md-6 pl-md-4 pl-1'
  warning.style.marginTop = '-2.6rem'
  warning.style.display = 'none'
  warning.innerHTML = `\
    ${warningIcon}
    <span>No changesets found.</span>
    <a class="Link--muted Link--inTextBlock" href="${createLink}">Create new</a>
  `

  const mergeBox = document.querySelector('.merge-pr')
  if (!mergeBox) return

  if (hasChangesetMergeWarning()) return
  mergeBox.insertAdjacentElement('afterend', warning)

  // The warning is hidden by default until the merge box has a merge button. This can be dynamic as
  // users click on the merge button, so we need to observe changes to the merge box
  const observer = new MutationObserver(checkMergeBox)
  observer.observe(mergeBox, { childList: true, subtree: true })
  checkMergeBox()

  function checkMergeBox() {
    // There's no dedicated merge button selector, so just go by any button which usually only a
    // mergeable state would have.
    const hasButton = mergeBox!.querySelector('button[type="button"]')
    if (hasButton) {
      warning.style.display = 'block'
    } else {
      warning.style.display = 'none'
    }
  }
}

function isReleasePr() {
  const prDescription = document.querySelector('.TimelineItem .comment-body')
  if (!prDescription) return false

  return prDescription.textContent
    .trimStart()
    .startsWith('This PR was opened by the Changesets release GitHub action')
}

function hasChangesetMergeWarning() {
  return !!document.querySelector('.warning-changesets')
}
