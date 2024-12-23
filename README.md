# GitHub Changesets (UserScript)

[Install on Greasyfork](https://greasyfork.org)

In a GitHub repository that uses [Changesets](https://github.com/changesets/changesets), this userscript adds a new "Changesets" section in the sidebar of pull requests. This makes it easy to view the changesets added in a PR, and add new changesets directly.

Compared to [Changesets bot](https://github.com/changesets/bot), this does not create a comment for each pull requests regarding information about changesets. The goal is to move the burden of creating and managing changesets to the maintainers so that contributors don't have to worry about this, and also allow better quality changesets.

With the above features, this userscript also automatically removes the changesets bot comment if it exists to reduce noise. (You can edit the script options at the top of the file to disable this behavior if desired)

## Sponsors

<p align="center">
  <a href="https://bjornlu.com/sponsors.svg">
    <img src="https://bjornlu.com/sponsors.svg" alt="Sponsors" />
  </a>
</p>

## License

MIT
