# GitHub Changesets Userscript

[Install on Greasyfork](https://greasyfork.org/en/scripts/521590-github-changesets)

If a GitHub repo uses [Changesets](https://github.com/changesets/changesets), this userscript adds a new "Changesets" section in the sidebar of pull requests of an overview of the changeset files and a one-click button to create a changeset.

Compared to the [Changesets bot](https://github.com/changesets/bot), this does not create a comment for each pull requests regarding information about changesets. The goal is to move the burden of creating and managing changesets to the maintainers so that contributors don't have to worry about this, and to also allow better quality changesets.

As such, this userscript will also automatically remove comments from the Changesets bot to reduce noise. (You can edit the script options at the top of the file to disable this behavior if desired)

## Screenshots

<!-- Useful repos -->
<!-- https://github.com/publint/publint -->
<!-- https://github.com/withastro/astro -->
<!-- https://github.com/pnpm/pnpm -->

Single changesets:

<img src="https://github.com/user-attachments/assets/d1ff9245-2fc4-409e-8011-b2329188aee1" width="280">

Multiple changesets:

<img src="https://github.com/user-attachments/assets/29efcd73-9a0a-4ecf-a7c6-f0cc3cd08f68" width="280">

## Sponsors

<p align="center">
  <a href="https://bjornlu.com/sponsors">
    <img src="https://bjornlu.com/sponsors.svg" alt="Sponsors" />
  </a>
</p>

## License

MIT
