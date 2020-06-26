window.$docsify = {
  name: "ecsy",
  loadSidebar: true,
  auto2top: true,
  homepage: "./README.md",
  relativePath: true,
  search: {
    paths: "auto",
    depth: 3
  },
  plugins: [window.docsifyTocBackPlugin]
};
