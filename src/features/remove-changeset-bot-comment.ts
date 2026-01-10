export function removeChangesetBotComment() {
  const changesetBotComment = document.querySelector(
    '.js-timeline-item:has(a.author[href="/apps/changeset-bot"])',
  )
  if (changesetBotComment) {
    changesetBotComment.remove()
  }
}
