import { addMergeWarning } from './features/add-merge-warning.ts'
import { addSidebarSection } from './features/add-sidebar-section.ts'
import { removeChangesetBotComment } from './features/remove-changeset-bot-comment.ts'
import { getUpdatedPackages, repoHasChangesetsSetup } from './changesets-utils.ts'
import { featureSettings } from './settings.ts'

const pageAlreadyRun = new Set<string>()

run()

// listen to github page loaded event
document.addEventListener('pjax:end', () => run())
document.addEventListener('turbo:render', () => run())

async function run() {
  if (
    !pageAlreadyRun.has(location.href) &&
    /^\/.+?\/.+?\/pull\/.+$/.exec(location.pathname) &&
    (await repoHasChangesetsSetup())
  ) {
    pageAlreadyRun.add(location.href)

    if (featureSettings['remove-changeset-bot-comment'].get()) {
      removeChangesetBotComment()
    }

    const updatedPackages = await getUpdatedPackages()
    await addSidebarSection(updatedPackages)
    await addMergeWarning(updatedPackages)
  }
}
