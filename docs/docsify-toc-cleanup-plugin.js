window.docsifyTocCleanupPlugin = function(hook) {
  hook.doneEach(function() {
    document
      .querySelector(".sidebar-nav")
      .querySelectorAll(".section-link")
      .forEach(link => {
        if (link.textContent.toLowerCase() === "parameters") {
          link.style.display = "none";
        }
      });
  });
};
