import { getCreateChangesetLink, type UpdatedPackages } from '../changesets-utils.ts'

export async function addSidebarSection(updatedPackages: UpdatedPackages) {
  if (hasSidebarSection()) return
  updatedPackages = sortUpdatedPackages(updatedPackages)

  const notificationsSideSection = document.querySelector(
    '.discussion-sidebar-item.sidebar-notifications',
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

function hasSidebarSection() {
  return !!document.querySelector('.sidebar-changesets')
}
