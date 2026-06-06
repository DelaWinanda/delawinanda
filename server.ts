import express from "express";
import http from "http";
import path from "path";
import { WebSocket, WebSocketServer } from "ws";
import * as mqtt from "mqtt";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { AppState, BROKER_LIST, ActivityLog, RelayState } from "./src/types.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Shared app state on server - matches type AppState
let appState: AppState = {
  activeBroker: 1, // Default CloudAMQP
  relays: {
    relay1: false,
    relay2: false,
    relay3: false,
    relay4: false,
  },
  sensor: {
    suhu: 27.5,
    kelembaban: 62.0,
    lastUpdated: new Date().toISOString(),
  },
  variasi1: false,
  variasi2: false,
  isSimulatedEspEnabled: true, // Enabled by default for flawless testing
};

// Activity logs storage (limit to last 200 items to avoid bloating memory)
let activityLogs: ActivityLog[] = [];

function addLog(
  type: ActivityLog["type"],
  message: string,
  brokerName: string,
  status: ActivityLog["status"],
  delayMs?: number
) {
  const log: ActivityLog = {
    id: Math.random().toString(36).substring(2, 11),
    timestamp: new Date().toISOString(),
    type,
    message,
    broker: brokerName,
    status,
    delayMs,
  };
  activityLogs.unshift(log);
  if (activityLogs.length > 200) {
    activityLogs.pop();
  }
  broadcastToWeb({ type: "NEW_LOG", payload: log });
}

// Map to track command publish timestamps to calculate roundtrip latency
const pendingCommands = new Map<string, number>();

// MQTT Clients
let dashboardMqtt: mqtt.MqttClient | null = null;
let simulatorMqtt: mqtt.MqttClient | null = null;

// Track active WebSocket clients
const wsClients = new Set<WebSocket>();

function broadcastToWeb(message: { type: string; payload: any }) {
  const data = JSON.stringify(message);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Simulated ESP32 Loop and Variables
let simInterval: NodeJS.Timeout | null = null;
let variationInterval: NodeJS.Timeout | null = null;
let simSuhu = 27.5;
let simKelembaban = 62.0;

function startSimulatedEsp() {
  stopSimulatedEsp();
  
  const broker = BROKER_LIST.find((b) => b.id === appState.activeBroker);
  if (!broker) return;

  addLog(
    "system",
    "Hardware Simulator ESP32 diaktifkan. Menghubungkan ke broker...",
    broker.nama,
    "info"
  );

  const connString = `mqtts://${broker.server}:${broker.port}`;
  // Use a unique client ID for the simulator
  const simClientId = `${broker.clientId}_Sim_${Math.random().toString(16).slice(2, 6)}`;

  try {
    simulatorMqtt = mqtt.connect(connString, {
      clientId: simClientId,
      username: broker.user,
      password: broker.pass,
      rejectUnauthorized: false, // Insecure-style like ESP32 setInsecure()
      keepalive: 60,
      reconnectPeriod: 5000,
    });

    simulatorMqtt.on("connect", () => {
      addLog(
        "connection",
        `[Simulator ESP32] Berhasil terhubung ke broker! Client ID: ${simClientId}`,
        broker.nama,
        "success"
      );
      
      const config = BROKER_LIST.find((b) => b.id === appState.activeBroker);
      const infoMsg = `Broker aktif: ${config?.nama || "Unknown"} (Simulated ESP32 over TLS)`;
      simulatorMqtt?.publish("status/broker", infoMsg);

      // Subscribe to control topics
      simulatorMqtt?.subscribe([
        "kontrol/relay1",
        "kontrol/relay2",
        "kontrol/relay3",
        "kontrol/relay4",
        "kontrol/variasi1",
        "kontrol/variasi2",
        "kontrol/broker",
      ], (err) => {
        if (!err) {
          addLog(
            "system",
            "[Simulator ESP32] Menyimak semua topik kontrol/...",
            broker.nama,
            "info"
          );
        }
      });
    });

    simulatorMqtt.on("message", (topic, payload) => {
      const message = payload.toString().trim();
      addLog(
        "system",
        `[Simulator ESP32 Serial Out] Pesan diterima [${topic}]: ${message}`,
        broker.nama,
        "info"
      );

      // Handle Relay commands
      if (topic.startsWith("kontrol/relay")) {
        const relayId = topic.replace("kontrol/relay", "") as "1" | "2" | "3" | "4";
        const relayKey = `relay${relayId}` as keyof RelayState;
        const state = message === "ON";
        
        appState.relays[relayKey] = state;
        broadcastToWeb({ type: "STATE_UPDATE", payload: appState });

      // Handle Variasi 1
      } else if (topic === "kontrol/variasi1") {
        if (message === "START") {
          appState.variasi2 = false;
          appState.variasi1 = true;
          broadcastToWeb({ type: "STATE_UPDATE", payload: appState });
          runVariation(1);
        } else if (message === "STOP") {
          appState.variasi1 = false;
          stopVariation();
        }

      // Handle Variasi 2
      } else if (topic === "kontrol/variasi2") {
        if (message === "START") {
          appState.variasi1 = false;
          appState.variasi2 = true;
          broadcastToWeb({ type: "STATE_UPDATE", payload: appState });
          runVariation(2);
        } else if (message === "STOP") {
          appState.variasi2 = false;
          stopVariation();
        }

      // Handle Broker Switch
      } else if (topic === "kontrol/broker") {
        const targetBrokerId = parseInt(message);
        if (targetBrokerId >= 1 && targetBrokerId <= BROKER_LIST.length) {
          addLog(
            "system",
            `[Simulator ESP32] Deteksi perintah pindah broker ke: Broker ${targetBrokerId}`,
            broker.nama,
            "warning"
          );
        }
      }
    });

    // Publish sensor data periodically
    simInterval = setInterval(() => {
      if (simulatorMqtt?.connected) {
        // Add tiny realistic fluctuations
        simSuhu += (Math.random() - 0.5) * 0.4;
        simKelembaban += (Math.random() - 0.5) * 0.8;
        
        // Boundaries
        if (simSuhu < 15) simSuhu = 15;
        if (simSuhu > 40) simSuhu = 40;
        if (simKelembaban < 30) simKelembaban = 30;
        if (simKelembaban > 95) simKelembaban = 95;

        const suhuStr = simSuhu.toFixed(1);
        const kelemStr = simKelembaban.toFixed(1);

        simulatorMqtt.publish("sensor/suhu", suhuStr);
        simulatorMqtt.publish("sensor/kelembaban", kelemStr);

        addLog(
          "sensor",
          `[Simulator ESP32 Telemetry] Mengirim Suhu: ${suhuStr}°C | Kelembaban: ${kelemStr}%`,
          broker.nama,
          "info"
        );
      }
    }, 5000);

  } catch (error: any) {
    addLog(
      "system",
      `Simulator ESP32 gagal start: ${error?.message || error}`,
      broker.nama,
      "error"
    );
  }
}

function stopSimulatedEsp() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  stopVariation();
  if (simulatorMqtt) {
    simulatorMqtt.end(true);
    simulatorMqtt = null;
  }
}

// Sequentially toggle relays for variations to emulate ESP32 hardware execution
function runVariation(type: number) {
  if (variationInterval) clearInterval(variationInterval);
  
  let step = 0;
  const pinsMaju = ["relay1", "relay2", "relay3", "relay4"];
  const pinsMundur = ["relay4", "relay3", "relay2", "relay1"];
  const order = type === 1 ? pinsMaju : pinsMundur;

  variationInterval = setInterval(() => {
    // turn off all
    appState.relays = {
      relay1: false,
      relay2: false,
      relay3: false,
      relay4: false,
    };
    
    // turn on target
    const targetRelay = order[step] as keyof RelayState;
    appState.relays[targetRelay] = true;
    
    broadcastToWeb({ type: "STATE_UPDATE", payload: appState });
    
    step++;
    if (step >= 4) step = 0;
  }, 100); // Fast sequence toggle (100ms step to visually look gorgeous in simulator UI)
}

function stopVariation() {
  if (variationInterval) {
    clearInterval(variationInterval);
    variationInterval = null;
  }
  appState.relays = {
    relay1: false,
    relay2: false,
    relay3: false,
    relay4: false,
  };
  broadcastToWeb({ type: "STATE_UPDATE", payload: appState });
}

// Connect Dashboard MQTT client (communicates between backend node client and broker)
function connectDashboardMqtt() {
  if (dashboardMqtt) {
    dashboardMqtt.end(true);
    dashboardMqtt = null;
  }

  const broker = BROKER_LIST.find((b) => b.id === appState.activeBroker);
  if (!broker) return;

  addLog(
    "connection",
    `Mencoba terhubung ke Broker: [${broker.nama}] (${broker.server})...`,
    broker.nama,
    "info"
  );

  const connString = `mqtts://${broker.server}:${broker.port}`;
  const webClientId = `${broker.clientId}_Dashboard_${Math.random().toString(16).slice(2, 6)}`;

  try {
    dashboardMqtt = mqtt.connect(connString, {
      clientId: webClientId,
      username: broker.user,
      password: broker.pass,
      rejectUnauthorized: false, // Insecure TLS support
      keepalive: 60,
      reconnectPeriod: 5000,
    });

    dashboardMqtt.on("connect", () => {
      addLog(
        "connection",
        `Koneksi Broker [${broker.nama}] berhasil terhubung!`,
        broker.nama,
        "success"
      );

      // Subscribe to sensors, confirmations, and commands to calculate latency
      dashboardMqtt?.subscribe([
        "sensor/suhu",
        "sensor/kelembaban",
        "status/broker",
        "kontrol/relay1",
        "kontrol/relay2",
        "kontrol/relay3",
        "kontrol/relay4",
        "kontrol/variasi1",
        "kontrol/variasi2",
      ], (err) => {
        if (!err) {
          addLog(
            "connection",
            "Dashboard mendengarkan status sensor, broker, dan kontrol feedback untuk kalkulasi latency.",
            broker.nama,
            "success"
          );
        }
      });
    });

    dashboardMqtt.on("reconnect", () => {
      addLog(
        "connection",
        `Menghubungkan ulang ke broker [${broker.nama}]...`,
        broker.nama,
        "warning"
      );
    });

    dashboardMqtt.on("error", (error) => {
      addLog(
        "connection",
        `Gagal terhubung ke [${broker.nama}]: ${error.message}`,
        broker.nama,
        "error"
      );
    });

    dashboardMqtt.on("message", (topic, payload) => {
      const message = payload.toString().trim();
      
      // Calculate delay/latency if this corresponds to a command we sent
      const pendingKey = `${topic}:${message}`;
      if (pendingCommands.has(pendingKey)) {
        const sentTime = pendingCommands.get(pendingKey) || 0;
        const delayMs = Date.now() - sentTime;
        pendingCommands.delete(pendingKey);
        
        let targetLabel = topic;
        if (topic.includes("relay")) {
          targetLabel = `Relay ${topic.slice(-1)}`;
        } else if (topic.includes("variasi")) {
          targetLabel = `Variasi ${topic.slice(-1)}`;
        }

        addLog(
          "command",
          `Broker merespon perintah [${targetLabel} -> ${message}] dengan sukses!`,
          broker.nama,
          "success",
          delayMs
        );
      }

      // Handle received telemetry
      if (topic === "sensor/suhu") {
        const temp = parseFloat(message);
        if (!isNaN(temp)) {
          appState.sensor.suhu = temp;
          appState.sensor.lastUpdated = new Date().toISOString();
          broadcastToWeb({ type: "STATE_UPDATE", payload: appState });
        }
      } else if (topic === "sensor/kelembaban") {
        const hum = parseFloat(message);
        if (!isNaN(hum)) {
          appState.sensor.kelembaban = hum;
          appState.sensor.lastUpdated = new Date().toISOString();
          broadcastToWeb({ type: "STATE_UPDATE", payload: appState });
        }
      } else if (topic === "status/broker") {
        addLog(
          "connection",
          `Status dari ESP Fisik: ${message}`,
          broker.nama,
          "info"
        );
      }
    });

  } catch (error: any) {
    addLog(
      "connection",
      `Gagal menginisialisasi MQTT client: ${error?.message || error}`,
      broker.nama,
      "error"
    );
  }
}

// Switch active broker
function switchBroker(brokerId: number) {
  if (brokerId < 1 || brokerId > BROKER_LIST.length) return;
  
  const currentBroker = BROKER_LIST.find((b) => b.id === appState.activeBroker);
  const targetBroker = BROKER_LIST.find((b) => b.id === brokerId);
  if (!targetBroker) return;

  appState.activeBroker = brokerId;
  appState.variasi1 = false;
  appState.variasi2 = false;

  addLog(
    "system",
    `Mengubah broker aktif dari ${currentBroker?.nama} ke ${targetBroker.nama}...`,
    targetBroker.nama,
    "warning"
  );

  broadcastToWeb({ type: "STATE_UPDATE", payload: appState });

  // Connect both Clients to the new Broker
  connectDashboardMqtt();
  if (appState.isSimulatedEspEnabled) {
    startSimulatedEsp();
  } else {
    stopSimulatedEsp();
  }
}

// Trigger initial connections
connectDashboardMqtt();
if (appState.isSimulatedEspEnabled) {
  startSimulatedEsp();
}

// HTTP Server Endpoints
app.use(express.json());

app.get("/api/state", (req, res) => {
  res.json(appState);
});

app.get("/api/logs", (req, res) => {
  res.json(activityLogs);
});

app.get("/api/brokers", (req, res) => {
  res.json(BROKER_LIST);
});

// Configure Vite or Static Files
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupViteOrStatic();

// Set up WebSockets
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws) => {
  wsClients.add(ws);

  // Send initial state & logs on connect
  ws.send(JSON.stringify({ type: "INITIAL_DATA", payload: { state: appState, logs: activityLogs } }));

  ws.on("message", (messageStr) => {
    try {
      const { type, payload } = JSON.parse(messageStr.toString());

      const broker = BROKER_LIST.find((b) => b.id === appState.activeBroker);
      const brokerName = broker ? broker.nama : "Unknown";

      switch (type) {
        case "SET_BROKER": {
          switchBroker(payload);
          break;
        }

        case "SET_RELAY": {
          const { relay, state } = payload; // e.g. "relay1", "ON" / "OFF"
          const relayNum = relay.replace("relay", ""); // "1"
          const topic = `kontrol/relay${relayNum}`;
          
          if (dashboardMqtt?.connected) {
            // Track timestamp to measure roundtrip broker latency
            pendingCommands.set(`${topic}:${state}`, Date.now());
            dashboardMqtt.publish(topic, state);

            addLog(
              "command",
              `Mengirim perintah ${relay.toUpperCase()} -> ${state} ke broker...`,
              brokerName,
              "info"
            );
          } else {
            addLog(
              "command",
              `Gagal mengirim perintah ${relay.toUpperCase()}: Dashboard tidak terhubung ke broker MQTT.`,
              brokerName,
              "error"
            );
          }
          break;
        }

        case "SET_VARIASI": {
          const { variasi, state } = payload; // variasi: 1 | 2, state: "START" | "STOP"
          const topic = `kontrol/variasi${variasi}`;

          if (dashboardMqtt?.connected) {
            pendingCommands.set(`${topic}:${state}`, Date.now());
            dashboardMqtt.publish(topic, state);

            addLog(
              "command",
              `Mengirim perintah perkusi/variasi ${variasi} -> ${state} ke broker...`,
              brokerName,
              "info"
            );
          } else {
            addLog(
              "command",
              `Gagal menjalankan variasi ${variasi}: Dashboard tidak terhubung ke broker MQTT.`,
              brokerName,
              "error"
            );
          }
          break;
        }

        case "TOGGLE_SIMULATOR": {
          appState.isSimulatedEspEnabled = payload;
          broadcastToWeb({ type: "STATE_UPDATE", payload: appState });

          if (payload) {
            startSimulatedEsp();
          } else {
            stopSimulatedEsp();
            addLog(
              "system",
              "Hardware Simulator ESP32 dinonaktifkan. Mode fisik penuh aktif.",
              brokerName,
              "warning"
            );
          }
          break;
        }

        case "VOICE_LOG": {
          // Store voice processing feedback in activity logs
          const { phrase, reply, status } = payload;
          addLog(
            "voice",
            `[Perintah Suara] "${phrase}" -> Respon: "${reply}"`,
            brokerName,
            status || "info"
          );
          break;
        }

        case "UPDATE_SIM_DHT": {
          const { suhu, kelembaban } = payload;
          simSuhu = suhu;
          simKelembaban = kelembaban;
          if (simulatorMqtt?.connected) {
            simulatorMqtt.publish("sensor/suhu", suhu.toFixed(1));
            simulatorMqtt.publish("sensor/kelembaban", kelembaban.toFixed(1));
          }
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error("WebSocket message processing failure", e);
    }
  });

  ws.on("close", () => {
    wsClients.delete(ws);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Web application running live on port ${PORT}`);
});
