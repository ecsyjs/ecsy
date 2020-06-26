window.docsifyTocBackPlugin = function(hook) {
  hook.doneEach(function() {
    const isApiPage = location.hash.split("?")[0].includes("/api/");
    let backLink = document.querySelector(".back-link");

    if (!isApiPage) {
      if (backLink) backLink.remove();
      return;
    }

    if (!backLink) {
      backLink = document.createElement("a");
      backLink.className = "back-link";
      backLink.innerHTML = "&larr;";
      const appName = document.querySelector(".app-name");
      appName.after(backLink);
    }

    backLink.href = "#/";
  });
};
