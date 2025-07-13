let map;
let markers = {};
let cattleData = [];
let currentCattle = null;
let chart;

const stops = [
  "Central Barn", "Water Trough", "Mango Orchard", "Open Grazing Field",
  "Mud Pond", "Wheat Zone", "Milking Station", "Shed Crossing", "Main Shelter"
];

const stopLocations = [
  [22.5700, 88.3600], [22.5705, 88.3610], [22.5710, 88.3620],
  [22.5715, 88.3630], [22.5720, 88.3640], [22.5725, 88.3650],
  [22.5730, 88.3660], [22.5735, 88.3670], [22.5740, 88.3680]
];

// Load data
fetch("data/cattles.json")
  .then(res => res.json())
  .then(data => {
    cattleData = data;
    initMap();
    initTable();
    initChart();
    setInterval(updateAll, 5000);
  });

function initMap() {
  map = L.map('map').setView([22.571, 88.363], 18);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  const offsetStep = 0.00008;
  const bounds = [];

  cattleData.forEach((cattle, index) => {
    let stopIndex = cattle.currentStop;
    if (!stopLocations[stopIndex]) stopIndex = 0;

    const baseLatLng = stopLocations[stopIndex];
    const offsetLat = baseLatLng[0] + ((index % 3) * offsetStep);
    const offsetLng = baseLatLng[1] + (Math.floor(index / 3) * offsetStep);

    bounds.push([offsetLat, offsetLng]);

    const iconHtml = `
      <div style="
        background-color: white;
        border: 2px solid #1E90FF;
        border-radius: 10px;
        text-align: center;
        font-size: 14px;
        padding: 4px 6px;
        width: 60px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        font-weight: bold;">
        🐄 ${cattle.id}
      </div>`;

    const customIcon = L.divIcon({
      html: iconHtml,
      iconSize: [60, 40],
      className: ''
    });

    const marker = L.marker([offsetLat, offsetLng], { icon: customIcon }).addTo(map);

    marker.bindTooltip(`Cattle ${cattle.id}`, { permanent: false });

    marker.on('click', () => {
      currentCattle = cattle;
      drawGraph(cattle);
    });

    marker.on('mouseover', () => {
      marker.bindPopup(getPopupHTML(cattle)).openPopup();
    });

    markers[cattle.id] = marker;
  });

  // Fit map to bounds of all markers
  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

function getPopupHTML(cattle) {
  return `
    <div>
      <strong>Cattle ID:</strong> ${cattle.id}<br>
      <strong>Status:</strong> ${cattle.status}<br>
      <strong>Current Stop:</strong> ${stops[cattle.currentStop]}<br>
      <strong>Travelled:</strong> ${cattle.travelled} km<br>
      <strong>Remaining:</strong> ${cattle.remaining} km
    </div>
  `;
}

function initTable() {
  const tbody = document.querySelector("#cattleTable tbody");
  tbody.innerHTML = "";

  cattleData.forEach(cattle => {
    const row = document.createElement("tr");
    row.className = getStatusClass(cattle.status);
    row.innerHTML = `
      <td>${cattle.id}</td>
      <td>${stops[cattle.currentStop]}</td>
      <td>${cattle.status}</td>
      <td>${cattle.travelled} km</td>
      <td>${cattle.remaining} km</td>
      <td>${cattle.grazingTime}</td>
      <td>${cattle.walkingTime}</td>
    `;
    tbody.appendChild(row);
  });
}

function getStatusClass(status) {
  if (status === "Grazing") return "status-grazing";
  if (status === "Moving") return "status-moving";
  return "status-reached";
}

function updateAll() {
  cattleData.forEach(cattle => {
    if (cattle.status !== "Reached") {
      if (Math.random() > 0.3) {
        cattle.status = "Moving";
        cattle.travelled++;
        cattle.remaining--;
        cattle.walkingTime += 5;

        if (cattle.remaining <= 0) {
          if (cattle.currentStop < stops.length - 1) {
            cattle.currentStop++;
            cattle.remaining = 5 + Math.floor(Math.random() * 10);
          } else {
            cattle.status = "Reached";
            cattle.remaining = 0;
          }
        }
      } else {
        cattle.status = "Grazing";
        cattle.grazingTime += 5;
      }

      const stopIndex = cattle.currentStop;
      markers[cattle.id].setLatLng(stopLocations[stopIndex]);
    }
  });

  initTable();
  updateChart();
  if (currentCattle) drawGraph(currentCattle);
}

function initChart() {
  const ctx = document.getElementById('stopChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stops,
      datasets: [{
        label: 'Cattle Count',
        data: Array(stops.length).fill(0),
        backgroundColor: '#4CAF50'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
  updateChart();
}

function updateChart() {
  const counts = Array(stops.length).fill(0);
  cattleData.forEach(c => counts[c.currentStop]++);
  chart.data.datasets[0].data = counts;
  chart.update();
}

function drawGraph(cattle) {
  const nodes = [], edges = [];

  for (let i = 0; i < stops.length; i++) {
    let color = 'lightgray';
    if (i < cattle.currentStop) color = 'lightgreen';
    else if (i === cattle.currentStop) color = 'yellow';

    nodes.push({
      id: i,
      label: stops[i],
      color: {
        background: color,
        border: '#888'
      },
      shape: 'box',
      font: {
        size: 18,
        face: 'Arial',
        color: '#333'
      },
      margin: 10
    });

    if (i > 0) {
      edges.push({ from: i - 1, to: i });
    }
  }

  const container = document.getElementById('networkGraph');
  const data = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(edges)
  };

  const options = {
    layout: {
      hierarchical: false,
      improvedLayout: true
    },
    nodes: {
      shape: 'box',
      widthConstraint: {
        minimum: 120
      },
      heightConstraint: {
        minimum: 50
      }
    },
    edges: {
      arrows: 'to',
      color: '#999',
      smooth: {
        type: 'cubicBezier',
        forceDirection: 'horizontal',
        roundness: 0.4
      }
    },
    interaction: {
      dragNodes: true,
      zoomView: true
    },
    physics: {
      enabled: true,
      solver: 'repulsion',
      repulsion: {
        nodeDistance: 200
      }
    }
  };

  new vis.Network(container, data, options);
}
