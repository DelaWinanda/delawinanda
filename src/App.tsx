import React, { useState, useEffect, useRef } from "react";
import { Server, Wifi, WifiOff, Activity, Cpu, Settings, RefreshCw, Layers } from "lucide-react";
import { AppState, BROKER_LIST, ActivityLog } from "./types";
import TelemetryDisplay from "./components/TelemetryDisplay";
import RelayControl from "./components/RelayControl";
import VoiceController from "./components/VoiceController";
import LogViewer from "./components/LogViewer";
import EspSimulator from "./components/EspSimulator";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [appState, setAppState] = useState<AppState>({
    activeBroker: 1,
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
    isSimulatedEspEnabled: true,
  });
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  const connectWs = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "INITIAL_DATA") {
          setAppState(data.payload.state);
          setLogs(data.payload.logs);
        } else if (data.type === "STATE_UPDATE") {
          setAppState(data.payload);
        } else if (data.type === "LOG_UPDATE") {
          setLogs(data.payload);
        } else if (data.type === "NEW_LOG") {
          setLogs((prev) => [data.payload, ...prev].slice(0, 200));
        }
      } catch (e) {
        console.error("WebSocket message parse failure:", e);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWs();
      }, 3000);
    };

    socket.onerror = (e) => {
      console.error("WebSocket error:", e);
      socket.close();
    };
  };

  const sendRelay = (relay: string, state: "ON" | "OFF") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "SET_RELAY",
          payload: { relay, state },
        })
      );
    }
  };

  const sendVariasi = (variasi: number, state: "START" | "STOP") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "SET_VARIASI",
          payload: { variasi, state },
        })
      );
    }
  };

  const setBroker = (id: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "SET_BROKER",
          payload: id,
        })
      );
    }
  };

  const sendVoiceLog = (phrase: string, reply: string, status: "success" | "warning" | "error") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "VOICE_LOG",
          payload: { phrase, reply, status },
        })
      );
    }
  };

  const toggleSimulator = (enabled: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "TOGGLE_SIMULATOR",
          payload: enabled,
        })
      );
    }
  };

  const simulateSensorChange = (temp: number, hum: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "UPDATE_SIM_DHT",
          payload: { suhu: temp, kelembaban: hum },
        })
      );
    }
  };

  const activeBroker = BROKER_LIST.find((b) => b.id === appState.activeBroker) || BROKER_LIST[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans antialiased pb-12">
      {/* Upper Navigation and Status Ribbon */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 py-4 px-6 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981] animate-pulse"></div>
            <div>
              <h1 className="font-display font-semibold tracking-tight text-lg text-white flex items-center gap-2">
                IOT_NODE_ESP32_X4
              </h1>
              <p className="text-xs text-slate-500 font-medium font-mono">
                FIRMWARE V2.1.0-STABLE • 4-CHANNEL MQTT RELAY MODULE
              </p>
            </div>
          </div>

          {/* Sync Connection Indicator */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold select-none border shadow-lg transition ${
                connected
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/25 text-rose-400 animate-pulse"
              }`}
            >
              {connected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SINKRON TERPADU</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>TERPUTUS</span>
                </>
              )}
            </div>

            <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-1 rounded">
              IP: 192.168.1.104
            </span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* BROKER SELECTION STRIP */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl" id="broker-selection-strip">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 font-bold tracking-tight text-slate-400 text-sm uppercase">
              <Server className="w-4 h-4 text-blue-400" />
              PILIH MQTT CONTAINER BROKER (ACTIVE SECURE ENDPOINT)
            </h2>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">Port 8883 SSL/TLS</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {BROKER_LIST.map((b) => {
              const isActive = b.id === appState.activeBroker;
              return (
                <button
                  key={b.id}
                  onClick={() => setBroker(b.id)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between h-[105px] ${
                    isActive
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-300"
                  }`}
                  id={`btn-select-broker-${b.id}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold tracking-tight text-sm uppercase">{b.nama}</span>
                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-900 text-slate-500 font-semibold"
                      }`}
                    >
                      B{b.id}
                    </span>
                  </div>

                  <div className="mt-1">
                    <p className={`text-[11px] font-mono truncate ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                      {b.server}
                    </p>
                    <p className={`text-[9px] font-mono mt-0.5 ${isActive ? "text-blue-200" : "text-slate-500"}`}>
                      Client: {isActive ? b.clientId + "_Web" : b.clientId}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* METRICS & CONTROLLER MATRIX */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Middle: Controls & Dials */}
          <div className="lg:col-span-7 space-y-6">
            <TelemetryDisplay sensor={appState.sensor} />
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <RelayControl
                relays={appState.relays}
                variasi1={appState.variasi1}
                variasi2={appState.variasi2}
                onToggleRelay={sendRelay}
                onToggleVariasi={sendVariasi}
              />
            </div>
          </div>

          {/* Right: Voice Actions & Latency Feed */}
          <div className="lg:col-span-5 space-y-6">
            <VoiceController
              onSendRelay={sendRelay}
              onSendVariasi={sendVariasi}
              onSetBroker={setBroker}
              suhu={appState.sensor.suhu}
              kelembaban={appState.sensor.kelembaban}
              activeBrokerName={activeBroker.nama}
              wsSendLog={sendVoiceLog}
            />

            <LogViewer logs={logs} />
          </div>
        </div>

        {/* FULL HARDWARE SIMULATOR DISPLAY */}
        <section className="pt-2">
          <EspSimulator
            relays={appState.relays}
            sensor={appState.sensor}
            isSimEnabled={appState.isSimulatedEspEnabled}
            activeBrokerName={activeBroker.nama}
            onToggleSimulator={toggleSimulator}
            onSimulateSensorChange={simulateSensorChange}
          />
        </section>
      </main>
    </div>
  );
}
