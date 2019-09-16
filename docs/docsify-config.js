window.$docsify = {
  name: "ecsy",
  loadSidebar: true,
  homepage: "../README.md",
  search: {
    paths: "auto",
    depth: 3
  },
  plugins: [window.docsifyTocBackPlugin, window.docsifyTocCleanupPlugin]
};
