// --- MQTT Configuration ---
const MQTT_HOST = "broker.hivemq.com";
const MQTT_PORT = 8884; // WebSocket WSS port
const MQTT_TOPIC = "wokwi/watertank/status";
const CLIENT_ID = "VSCodeDashboard_" + Math.random().toString(16).substr(2, 8);

// --- Chart.js Setup ---
const ctx = document.getElementById('levelChart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Water Level (%)',
      data: [],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      borderWidth: 2,
      fill: true,
      tension: 0.35,
      pointRadius: 2
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { color: '#64748b', maxTicksLimit: 6 },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      }
    },
    plugins: {
      legend: { display: false }
    }
  }
});

// --- Initialize MQTT Paho Client ---
const client = new Paho.MQTT.Client(MQTT_HOST, MQTT_PORT, CLIENT_ID);

client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

connectMQTT();

function connectMQTT() {
  updateStatus("Connecting...", "yellow");
  client.connect({
    onSuccess: onConnect,
    onFailure: onFailure,
    useSSL: true
  });
}

function onConnect() {
  updateStatus("Connected", "green");
  client.subscribe(MQTT_TOPIC);
  console.log("Subscribed to MQTT Topic:", MQTT_TOPIC);
}

function onFailure(responseObject) {
  updateStatus("Disconnected", "red");
  console.error("MQTT Connection Failed:", responseObject.errorMessage);
  setTimeout(connectMQTT, 5000); // Retry every 5 seconds
}

function onConnectionLost(responseObject) {
  updateStatus("Disconnected", "red");
  if (responseObject.errorCode !== 0) {
    console.warn("Connection lost:", responseObject.errorMessage);
    setTimeout(connectMQTT, 5000);
  }
}

// --- Process Incoming Telemetry Payload ---
function onMessageArrived(message) {
  try {
    const data = JSON.parse(message.payloadString);
    console.log("Received payload:", data);

    const level = data.level !== undefined ? data.level : 0;
    const pumpState = data.pump || "OFF";

    updateUI(level, pumpState);
  } catch (e) {
    console.error("Failed to parse incoming MQTT JSON:", e);
  }
}

// --- Update UI Elements ---
function updateUI(level, pumpState) {
  // 1. Update Numeric Values
  document.getElementById('levelVal').innerText = level + '%';
  document.getElementById('gaugeLevelText').innerText = level + '%';

  // 2. Adjust Water Level Gauge Height and Color Class
  const waterFill = document.getElementById('waterFill');
  waterFill.style.height = level + '%';

  if (level >= 95) {
    waterFill.className = "water-fill water-fill-alarm";
  } else if (level <= 20) {
    waterFill.className = "water-fill water-fill-low";
  } else {
    waterFill.className = "water-fill water-fill-normal";
  }

  // 3. Update Pump Status Badge
  const pumpBadge = document.getElementById('pumpBadge');
  if (pumpState === "ON") {
    pumpBadge.className = "badge-pump-running";
    pumpBadge.innerText = "RUNNING";
  } else {
    pumpBadge.className = "badge-off";
    pumpBadge.innerText = "OFF";
  }

  // 4. Update Overflow Alarm Badge
  const alarmBadge = document.getElementById('alarmBadge');
  if (level >= 95) {
    alarmBadge.className = "badge-alarm-active";
    alarmBadge.innerText = "OVERFLOW ALARM";
  } else {
    alarmBadge.className = "badge-off";
    alarmBadge.innerText = "NORMAL";
  }

  // 5. Update Time-Series Chart
  const now = new Date().toLocaleTimeString();
  chart.data.labels.push(now);
  chart.data.datasets[0].data.push(level);

  // Keep a maximum of 15 data points on chart
  if (chart.data.labels.length > 15) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();

  // 6. Update Last Received Time
  document.getElementById('lastUpdated').innerText = 'Last update: ' + now;
}

// Helper to toggle header connection dot
function updateStatus(text, color) {
  const dot = document.getElementById('statusDot');
  const textElem = document.getElementById('statusText');
  
  textElem.innerText = text;
  if (color === "green") {
    dot.className = "w-3 h-3 rounded-full status-dot-connected";
  } else if (color === "red") {
    dot.className = "w-3 h-3 rounded-full status-dot-disconnected";
  } else {
    dot.className = "w-3 h-3 rounded-full status-dot-connecting";
  }
}