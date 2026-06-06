import React from "react";
import { Power, Layers, RefreshCw, Zap, Play, Square } from "lucide-react";
import { RelayState } from "../types";

interface RelayControlProps {
  relays: RelayState;
  variasi1: boolean;
  variasi2: boolean;
  onToggleRelay: (relay: string, state: "ON" | "OFF") => void;
  onToggleVariasi: (variasi: number, state: "START" | "STOP") => void;
}

export default function RelayControl({
  relays,
  variasi1,
  variasi2,
  onToggleRelay,
  onToggleVariasi,
}: RelayControlProps) {
  
  const relayConfig = [
    { id: "relay1", label: "Relay 1", pin: "GPIO 23", beban: "Kipas Ventilator", active: relays.relay1 },
    { id: "relay2", label: "Relay 2", pin: "GPIO 19", beban: "Lampu Penerangan", active: relays.relay2 },
    { id: "relay3", label: "Relay 3", pin: "GPIO 18", beban: "Sistem Pengairan (Pompa)", active: relays.relay3 },
    { id: "relay4", label: "Relay 4", pin: "GPIO 05", beban: "Alat Pemanas (Heater)", active: relays.relay4 },
  ];

  return (
    <div className="space-y-6" id="relay-controls-panel">
      {/* Manual Switches Header */}
      <div>
        <h3 className="font-bold tracking-tight text-base mb-4 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <span className="flex items-center gap-2 text-white">
            <Power className="w-5 h-5 text-emerald-400" />
            Relay Matrix Control
          </span>
          <span className="text-[10px] font-semibold font-mono bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-1 rounded-full uppercase self-start sm:self-auto">
            Active-Low (ON = LOW Pin)
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {relayConfig.map((r, i) => (
            <div
              key={r.id}
              className={`rounded-2xl border p-4 transition-all flex items-center justify-between ${
                r.active
                  ? "bg-slate-800/60 border-emerald-500/30 shadow-lg"
                  : "bg-slate-850/40 border-slate-800 text-slate-300"
              }`}
            >
              <div className="flex flex-col gap-1 select-none">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    r.active ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-500 border border-slate-700"
                  }`}>
                    R{i + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-white">{r.label}</h4>
                    <p className={`text-[10px] font-bold ${r.active ? "text-emerald-400" : "text-slate-500"}`}>
                      STATUS: {r.active ? "ACTIVE" : "IDLE"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 pl-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-900 border border-slate-800 text-slate-400">
                    {r.pin}
                  </span>
                  <span className="text-xs text-slate-400 truncate max-w-[130px]">{r.beban}</span>
                </div>
              </div>

              {/* Slider switch container */}
              <button
                onClick={() => onToggleRelay(r.id, r.active ? "OFF" : "ON")}
                className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${
                  r.active ? "bg-emerald-500" : "bg-slate-700"
                }`}
                id={`btn-toggle-${r.id}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  r.active ? "right-1" : "left-1"
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Program Variasi Relay */}
      <div>
        <h3 className="font-bold text-slate-300 tracking-tight text-base mb-3 flex items-center gap-1.5">
          <Layers className="w-5 h-5 text-blue-400 animate-spin-slow" />
          Program Variasi Otomatis (Sequential)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Variasi 1: Maju */}
          <div className={`p-4 rounded-2xl border transition ${
            variasi1 ? "bg-slate-800 border-blue-500/30" : "bg-slate-850/40 border-slate-800 shadow-xl"
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-bold text-white text-sm">Variasi 1 (Maju Sequential)</h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Delay: 50ms | Urutan: 1 → 2 → 3 → 4</p>
              </div>
              <span className={`p-1 w-2.5 h-2.5 rounded-full ${variasi1 ? "bg-blue-400 animate-ping" : "bg-slate-700"}`} />
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Menyalakan relay satu-persatu berurutan maju dengan rentang delay singkat, mengaktifkan efek laju berlanjut.
            </p>

            <button
              onClick={() => onToggleVariasi(1, variasi1 ? "STOP" : "START")}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xl ${
                variasi1
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-slate-850 border border-slate-700 hover:bg-slate-800 text-white"
              }`}
              id="btn-variasi1"
            >
              {variasi1 ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>STOP VARIASI 1</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-blue-400 fill-current" />
                  <span>VARIASI 1 (FWD)</span>
                </>
              )}
            </button>
          </div>

          {/* Variasi 2: Mundur */}
          <div className={`p-4 rounded-2xl border transition ${
            variasi2 ? "bg-slate-800 border-purple-500/30" : "bg-slate-850/40 border-slate-800 shadow-xl"
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-bold text-white text-sm">Variasi 2 (Mundur Sequential)</h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Delay: 50ms | Urutan: 4 → 3 → 2 → 1</p>
              </div>
              <span className={`p-1 w-2.5 h-2.5 rounded-full ${variasi2 ? "bg-purple-400 animate-ping" : "bg-slate-700"}`} />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Mengalihkan urutan pengerjaan berkebalikan dari variasi satu, melaju mundur dari pin belakang ke depan.
            </p>

            <button
              onClick={() => onToggleVariasi(2, variasi2 ? "STOP" : "START")}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xl ${
                variasi2
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-slate-850 border border-slate-700 hover:bg-slate-800 text-white"
              }`}
              id="btn-variasi2"
            >
              {variasi2 ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>STOP VARIASI 2</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-purple-400 fill-current" />
                  <span>VARIASI 2 (REV)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
