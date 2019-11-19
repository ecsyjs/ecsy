/* global Peer */
function generateId(length) {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result.toUpperCase();
}

function log(msg) {
  //console.log(msg);
}

export function enableRemoteDevtools() {
  window.generateNewCode = () => {
    window.localStorage.clear();
    remoteId = generateId(6);
    window.localStorage.setItem("ecsyRemoteId", remoteId);
    window.location.reload(false);
  };

  let remoteId = window.localStorage.getItem("ecsyRemoteId");
  if (!remoteId) {
    remoteId = generateId(6);
    window.localStorage.setItem("ecsyRemoteId", remoteId);
  }

  let infoDiv = document.createElement("div");
  infoDiv.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40px;
    opacity: 0.9;
    font-size: 1.1em;
    color: #fff;
    display:flex;
    align-items: center;
    justify-content: center;
    font-family: Arial;
    text-align: center;
    background-color: #333`;

  infoDiv.innerHTML = `Open ECSY devtools to connect to this page using the code: "<b>${remoteId}</b>"&nbsp;<button onClick="generateNewCode()">Generate new code</button>`;
  document.body.appendChild(infoDiv);
  window.__ECSY_REMOTE_DEVTOOLS_INJECTED = true;
  window.__ECSY_REMOTE_DEVTOOLS = {};

  ////////////
  let Version = "";
  let worldsBeforeLoading = [];
  let onWorldCreated = e => {
    var world = e.detail.world;
    Version = e.detail.version;
    log("World created before", world);
    worldsBeforeLoading.push(world);
  };

  window.addEventListener("ecsy-world-created", onWorldCreated);

  var script = document.createElement("script");
  // @todo Use link to the ecsy-devtools repo?
  script.src = "https://cdn.jsdelivr.net/npm/peerjs@0.3.20/dist/peer.min.js";
  script.onload = () => {
    var peer = new Peer(remoteId);
    peer.on("open", id => {
      log("My peer ID is: " + id);
      peer.on("connection", conn => {
        log("On connection");
        window.__ECSY_REMOTE_DEVTOOLS.connection = conn;

        conn.on("open", function() {
          log("On open");
          infoDiv.style.visibility = "hidden";

          // Receive messages
          conn.on("data", function(data) {
            log("On data");
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
        });
      });
    });
  };
  (document.head || document.documentElement).appendChild(script);
}

const urlParams = new URLSearchParams(window.location.search);

// @todo Provide a way to disable it if needed
if (urlParams.has("enableRemoteDevtools")) {
  enableRemoteDevtools();
}
