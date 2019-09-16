window.docsifyTocBackPlugin = function(hook) {
  hook.doneEach(function() {
    if (document.querySelector(".back-link") || location.href.endsWith("#/")) {
      return;
    }

    const backLink = document.createElement("a");
    backLink.className = "back-link";
    backLink.href = "/docs";
    backLink.innerHTML = "&larr;";

    const appName = document.querySelector(".app-name");
    appName.after(backLink);
  });
};
