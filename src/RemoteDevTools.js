/* global Peer */
export function enableRemoteDevtools() {
  let infoDiv = document.createElement("div");
  infoDiv.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 25px;
    opacity: 0.8;
    color: #fff;
    display:flex;
    align-items: center;
    justify-content: center;
    font-family: Arial;
    text-align: center;
    background-color: #333`;
  let code = "ED23";
  infoDiv.innerHTML = `Open ECSY devtools and use the code "<b>${code}</b>" to connect to this page`;
  document.body.appendChild(infoDiv);
  window.__ECSY_REMOVE_DEVTOOLS_INJECTED = true;

  ////////////
  let Version = "";
  let worldsBeforeLoading = [];
  let onWorldCreated = e => {
    var world = e.detail.world;
    Version = e.detail.version;
    console.log("World created before", world);
    worldsBeforeLoading.push(world);
  };

  window.addEventListener("ecsy-world-created", onWorldCreated);

  var script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/peerjs@0.3.20/dist/peer.min.js";
  script.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);

    let id = urlParams.get("remoteId");
    id = "ED23";
    var peer = new Peer(id);
    peer.on("open", id => {
      console.log("My peer ID is: " + id);

      peer.on("connection", conn => {
        window.conn = conn;
        conn.on("open", function() {
          infoDiv.style.visibility = "hidden";
          // Receive messages
          conn.on("data", function(data) {
            if (data.type === "init") {
              var script = document.createElement("script");
              script.textContent = data.script;
              script.onload = () => {
                script.parentNode.removeChild(script);
              };
              window.removeEventListener("ecsy-world-created", onWorldCreated);
              setTimeout(() => {
                worldsBeforeLoading.forEach(world => {
                  var event = new CustomEvent("ecsy-world-created", {
                    detail: { world: world, version: Version }
                  });
                  window.dispatchEvent(event);
                });
              }, 1000);

              (document.head || document.documentElement).appendChild(script);

              var wrapFunctions = ["error", "warning", "log"];
              wrapFunctions.forEach(key => {
                if (typeof console[key] === "function") {
                  var fn = console[key].bind(console);
                  console[key] = (...args) => {
                    conn.send({
                      method: "console",
                      type: key,
                      args: JSON.stringify(args)
                    });
                    return fn.apply(null, args);
                  };
                }
              });

              window.addEventListener("error", error => {
                conn.send({
                  method: "error",
                  error: JSON.stringify({
                    message: error.error.message,
                    stack: error.error.stack
                  })
                });
              });
            } else if (data.type === "executeScript") {
              let value = eval(data.script);
              if (data.returnEval) {
                conn.send({
                  method: "evalReturn",
                  value: value
                });
              }
            }
          });

          // Send messages
          //conn.send("Hello!");
        });
      });
    });
  };
  (document.head || document.documentElement).appendChild(script);
}
