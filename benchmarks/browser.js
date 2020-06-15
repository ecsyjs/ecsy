import { Benchmarks } from "benchmarker-js";
import { init as initEntities } from "./entities.bench.js";
import { init as initWorld } from "./world.bench.js";
import { init as initPool } from "./objectpool.bench.js";
import { init as initComponents } from "./components.bench.js";

const div = document.getElementById("results");

let currentTable = null;
let currentGroup = null;

function onGroupStart(groupName) {
  var title = document.createElement("div");
  title.setAttribute("class", "table-title");
  title.innerHTML = `<h3>${groupName}</h3>`;
  div.appendChild(title);

  currentTable = document.createElement("table");
  currentTable.setAttribute("class", "table-fill");

  let headCells = [
    "benchmark",
    "iterations",
    "min",
    "max",
    "sum",
    "mean",
    "variance",
    "std_deviation"
  ]
    .map(name => `<th>${name}</th>`)
    .join("");

  currentTable.innerHTML = `<thead>
  <tr>
    ${headCells}
  </tr>
  </thead><tbody></tbody>`;
  div.appendChild(currentTable);

  currentGroup = groupName;
}

function onBenchmarkFinished(bench) {
  if (currentGroup !== bench.groupName) {
    onGroupStart(bench.groupName);
  }

  const values = bench.stats.getAll();

  const tbody = currentTable.querySelector("tbody");

  let rowHtml = `<td>${bench.name}</td><td>${bench.iterations}</td>`;

  const toFixed = ["mean", "variance", "standard_deviation"];
  Object.entries(values).forEach(([key, value]) => {
    if (key !== "n") {
      if (toFixed.indexOf(key) !== -1) {
        value = value.toFixed(2);
      }
      rowHtml += `<td>${value}</td>`;
    }
  });

  let row = document.createElement("tr");
  row.innerHTML = rowHtml;
  tbody.appendChild(row);
}

let benchmarks = new Benchmarks({
  //  verbose: true,
  summary: true,
  iterations: 10,
  onBenchmarkFinished: onBenchmarkFinished
});

initWorld(benchmarks);
//initEntities(benchmarks);
initPool(benchmarks);
//initComponents(benchmarks);
benchmarks.run();

console.log(benchmarks.getReport("json"));
