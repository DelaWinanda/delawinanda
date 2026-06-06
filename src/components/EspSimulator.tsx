import React, { useState, useEffect, useRef } from "react";
import { Cpu, Thermometer, Droplet, ToggleLeft, ToggleRight, Terminal } from "lucide-react";
import { RelayState, SensorData } from "../types";

interface EspSimulatorProps {
  relays: RelayState;
  sensor: SensorData;
  isSimEnabled: boolean;
  activeBrokerName: string;
  onToggleSimulator: (enabled: boolean) => void;
  // Callback when user drags temperature or humidity from the simulator
  onSimulateSensorChange: (temp: number, hum: number) => void;
}

export default function EspSimulator({
  relays,
  sensor,
  isSimEnabled,
  activeBrokerName,
  onToggleSimulator,
  onSimulateSensorChange,
}: EspSimulatorProps) {
  const [localTemp, setLocalTemp] = useState(sensor.suhu);
  const [localHum, setLocalHum] = useState(sensor.kelembaban);
  const [serialLogs, setSerialLogs] = useState<string[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Sync with real sensor values periodically if not dragging
  useEffect(() => {
    setLocalTemp(sensor.suhu);
    setLocalHum(sensor.kelembaban);
  }, [sensor.suhu, sensor.kelembaban]);

  // Generate realistic ESP32 Serial Monitor prints
  useEffect(() => {
    if (!isSimEnabled) {
      setSerialLogs((prev) => [
        ...prev,
        `[SYSTEM] ${new Date().toLocaleTimeString()}: ESP32 Simulator disabled. Full hardware proxy offline.`
      ]);
      return;
    }

    const initialLogs = [
      `[ESP32] Booting hardware emulator...`,
      `[ESP32] SDK Version: ESP-IDF v4.4.3-dirty`,
      `[ESP32] CPU Frequency: 240 MHz`,
      `[ESP32] Flash Size: 4MB (QIO 80MHz)`,
      `[WiFi] Menghubungkan ke WiFi: Beli Dong`,
      `[WiFi] WiFi terhubung. IP: 192.168.1.182`,
      `[DHT11] Sensor DHT11 berhasil diinisialisasi.`,
      `[MQTT] Menghubungkan ke broker [${activeBrokerName}] TLS 8883...`,
      `[MQTT] TERHUBUNG! Berlangganan topik kontrol/...`,
      `[MQTT] Publish status/broker -> "Broker aktif: ${activeBrokerName}"`
    ];
    setSerialLogs(initialLogs);
  }, [isSimEnabled, activeBrokerName]);

  // Watch for relay changes and print corresponding ESP32 Serial prints
  const prevRelays = useRef(relays);
  useEffect(() => {
    if (!isSimEnabled) return;

    const logsToAdd: string[] = [];
    const t = new Date().toLocaleTimeString();

    if (relays.relay1 !== prevRelays.current.relay1) {
      logsToAdd.push(`[SERIAL] ${t}: Pesan diterima [kontrol/relay1]: ${relays.relay1 ? "ON" : "OFF"}`);
      logsToAdd.push(`[GPIO] Pin 23 (Relay 1) -> ${relays.relay1 ? "LOW (Active-Low ON)" : "HIGH (OFF)"}`);
    }
    if (relays.relay2 !== prevRelays.current.relay2) {
      logsToAdd.push(`[SERIAL] ${t}: Pesan diterima [kontrol/relay2]: ${relays.relay2 ? "ON" : "OFF"}`);
      logsToAdd.push(`[GPIO] Pin 19 (Relay 2) -> ${relays.relay2 ? "LOW (Active-Low ON)" : "HIGH (OFF)"}`);
    }
    if (relays.relay3 !== prevRelays.current.relay3) {
      logsToAdd.push(`[SERIAL] ${t}: Pesan diterima [kontrol/relay3]: ${relays.relay3 ? "ON" : "OFF"}`);
      logsToAdd.push(`[GPIO] Pin 18 (Relay 3) -> ${relays.relay3 ? "LOW (Active-Low ON)" : "HIGH (OFF)"}`);
    }
    if (relays.relay4 !== prevRelays.current.relay4) {
      logsToAdd.push(`[SERIAL] ${t}: Pesan diterima [kontrol/relay4]: ${relays.relay4 ? "ON" : "OFF"}`);
      logsToAdd.push(`[GPIO] Pin 5  (Relay 4) -> ${relays.relay4 ? "LOW (Active-Low ON)" : "HIGH (OFF)"}`);
    }

    if (logsToAdd.length > 0) {
      setSerialLogs((prev) => [...prev, ...logsToAdd]);
    }
    prevRelays.current = relays;
  }, [relays, isSimEnabled]);

  // Periodic telemetry log print
  useEffect(() => {
    if (!isSimEnabled) return;

    const interval = setInterval(() => {
      const t = new Date().toLocaleTimeString();
      setSerialLogs((prev) => [
        ...prev,
        `[MQTT] ${t}: Publish sensor/suhu -> ${localTemp.toFixed(1)}°C`,
        `[MQTT] ${t}: Publish sensor/kelembaban -> ${localHum.toFixed(1)}%`,
        `[SERIAL] Suhu: ${localTemp.toFixed(1)} °C | Kelembaban: ${localHum.toFixed(1)} %`
      ]);
    }, 5000);

    return () => clearInterval(interval);
  }, [localTemp, localHum, isSimEnabled]);

  // Scroll to bottom of Console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [serialLogs]);

  const handleTempSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLocalTemp(val);
    onSimulateSensorChange(val, localHum);
  };

  const handleHumSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLocalHum(val);
    onSimulateSensorChange(localTemp, val);
  };

  const clearLogs = () => {
    setSerialLogs([`[SERIAL] Console cleared at ${new Date().toLocaleTimeString()}`]);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-slate-100 flex flex-col h-full" id="esp32-simulator-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-400 animate-pulse" />
          <div>
            <h3 className="font-semibold text-white text-base tracking-tight">ESP32 Hardware Simulator</h3>
            <p className="text-xs text-slate-400">Uji fungsionalitas IoT tanpa perangkat keras fisik</p>
          </div>
        </div>

        <button
          onClick={() => onToggleSimulator(!isSimEnabled)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
            isSimEnabled
              ? "bg-indigo-600 hover:bg-indigo-700 text-white"
              : "bg-slate-850 hover:bg-slate-800 text-slate-400"
          }`}
          id="btn-toggle-simulator-mode"
        >
          {isSimEnabled ? (
            <>
              <ToggleRight className="w-4 h-4 text-emerald-300" />
              <span>SIMULASI AKTIF</span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-4 h-4 text-slate-500" />
              <span>SIMULASI MATI</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Visual ESP32 Layout */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-slate-950 border border-slate-850 rounded-2xl p-5 relative">
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isSimEnabled ? "bg-emerald-500 animate-ping" : "bg-rose-500"}`}></span>
            <span className="text-[10px] font-mono text-slate-400">{isSimEnabled ? "ONLINE" : "STANDBY"}</span>
          </div>

          {/* Integrated Circuit Illustration */}
          <div className="flex flex-col items-center">
            <div className="w-36 h-48 bg-slate-800 border-2 border-slate-700 rounded-xl relative p-3 flex flex-col items-center justify-between shadow-lg">
              {/* Antenna block */}
              <div className="w-11/12 h-6 bg-slate-900 rounded border border-slate-750 flex items-center justify-center text-[10px] font-mono text-slate-500">
                WiFi Antenna
              </div>

              {/* Silicon MCU element */}
              <div className="w-24 h-24 bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-col items-center justify-center relative shadow-inner">
                <Cpu className="w-8 h-8 text-slate-500 mb-1" />
                <span className="text-[9px] font-mono font-bold text-slate-400">ESP32-WROOM</span>
                <span className="text-[7px] font-mono text-slate-500">Dual Core Xtensa</span>
                
                {/* Embedded status LED */}
                <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${isSimEnabled ? "bg-blue-500 shadow-[0_0_8px_4px_rgba(59,130,246,0.6)]" : "bg-slate-700"}`}></div>
              </div>

              {/* Connector Pins Row */}
              <div className="w-full flex justify-between px-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[6px] text-slate-500 font-mono">IO23</span>
                  <span className="text-[6px] text-slate-500 font-mono">IO19</span>
                </div>
                <span className="text-[7px] text-indigo-400 font-mono font-semibold self-end">Ai IoT Board</span>
                <div className="flex flex-col gap-0.5 items-end">
                  <span className="text-[6px] text-slate-500 font-mono">IO18</span>
                  <span className="text-[6px] text-slate-500 font-mono">IO5</span>
                </div>
              </div>
            </div>
          </div>

          {/* Relay LEDs Panel */}
          <div className="mt-5 bg-slate-900/40 border border-slate-850/50 rounded-xl p-3 flex flex-col gap-3">
            <div className="text-[10px] font-mono font-semibold text-slate-400 select-none pb-1.5 border-b border-slate-850/50">
              LEDS OUTPUT (GPIO RELAY COILS)
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "R1", pin: "IO23", active: relays.relay1 },
                { label: "R2", pin: "IO19", active: relays.relay2 },
                { label: "R3", pin: "IO18", active: relays.relay3 },
                { label: "R4", pin: "IO05", active: relays.relay4 },
              ].map((r, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 bg-slate-950/40 p-1.5 border border-slate-850/20 rounded-lg">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      r.active
                        ? "bg-rose-600 text-white shadow-[0_0_12px_rgba(239,68,68,0.7)] border border-rose-400"
                        : "bg-slate-800 text-slate-500 border border-slate-700"
                    }`}
                  >
                    <span className="text-[8px] font-bold font-mono">{r.label}</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500">{r.pin}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Simulated Sensors Interactivity */}
          <div className="mt-4 bg-slate-900/40 border border-slate-850/50 rounded-xl p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-indigo-300 pb-1.5 border-b border-slate-850/50">
              <span>DHT11 SIMULATOR KNOBS</span>
              <span className="text-[8px] text-slate-400">Geser untuk merubah suhu & kelembaban</span>
            </div>

            <div className="space-y-3 pt-1">
              {/* Temp control */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                    Suhu (Suhu Lingkungan)
                  </span>
                  <span className="font-mono text-white font-semibold">{localTemp.toFixed(1)}°C</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="40"
                  step="0.5"
                  value={localTemp}
                  disabled={!isSimEnabled}
                  onChange={handleTempSlider}
                  className="w-full accent-indigo-500 h-1 rounded bg-slate-800 outline-none disabled:opacity-30 cursor-pointer"
                />
              </div>

              {/* Humidity control */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Droplet className="w-3.5 h-3.5 text-blue-400" />
                    Kelembaban Udara
                  </span>
                  <span className="font-mono text-white font-semibold">{localHum.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="95"
                  step="1"
                  value={localHum}
                  disabled={!isSimEnabled}
                  onChange={handleHumSlider}
                  className="w-full accent-indigo-500 h-1 rounded bg-slate-800 outline-none disabled:opacity-30 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Console / Serial Monitor */}
        <div className="lg:col-span-7 flex flex-col bg-slate-950 border border-slate-850 rounded-2xl min-h-[250px] lg:min-h-0 relative">
          <div className="flex items-center justify-between bg-slate-900/50 px-4 py-2.5 rounded-t-2xl border-b border-slate-850">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-semibold text-slate-200">ESP32 Serial Monitor @ 115200 Baud</span>
            </div>
            <button
              onClick={clearLogs}
              className="text-[10px] font-mono hover:text-white text-slate-400 bg-slate-800 hover:bg-slate-755 border border-slate-700 px-2 py-0.5 rounded cursor-pointer transition"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 custom-scrollbar min-h-0 select-text max-h-[350px] lg:max-h-none">
            {serialLogs.map((log, index) => {
              let color = "text-slate-330";
              if (log.includes("[GPIO]")) color = "text-indigo-300";
              else if (log.includes("[SERIAL]")) color = "text-amber-300";
              else if (log.includes("[MQTT]")) color = "text-emerald-400";
              else if (log.includes("[WiFi]")) color = "text-sky-300";
              else if (log.includes("[SYSTEM]")) color = "text-slate-500 italic";
              else if (log.includes("Gagal") || log.includes("Error")) color = "text-rose-400 font-bold";
              else if (log.includes("TERHUBUNG") || log.includes("terhubung")) color = "text-emerald-300 font-semibold";

              return (
                <div key={index} className={`${color} leading-relaxed`}>
                  {log}
                </div>
              );
            })}
            <div ref={consoleEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
