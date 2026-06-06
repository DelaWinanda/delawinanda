import React, { useState } from "react";
import { ActivityLog } from "../types";
import { ListFilter, RefreshCw, Zap, Server, Phone, Info, Timer, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";

interface LogViewerProps {
  logs: ActivityLog[];
  onClearLogs?: () => void;
}

type LogFilter = "ALL" | "CONNECTION" | "COMMAND" | "SENSOR" | "VOICE" | "SYSTEM";

export default function LogViewer({ logs, onClearLogs }: LogViewerProps) {
  const [filter, setFilter] = useState<LogFilter>("ALL");

  // Filter logic
  const filteredLogs = logs.filter((log) => {
    if (filter === "ALL") return true;
    return log.type.toUpperCase() === filter;
  });

  // Calculate Average Latency benchmarks per broker in real-time!
  const calculateBrokerLatencyStats = () => {
    const brokers = ["CloudAMQP", "Cedalo", "Flespi"];
    const stats: { [name: string]: { totalMs: number; count: number } } = {
      CloudAMQP: { totalMs: 0, count: 0 },
      Cedalo: { totalMs: 0, count: 0 },
      Flespi: { totalMs: 0, count: 0 },
    };

    // Aggregate delay metrics
    logs.forEach((log) => {
      if (log.delayMs !== undefined && stats[log.broker] !== undefined) {
        stats[log.broker].totalMs += log.delayMs;
        stats[log.broker].count += 1;
      }
    });

    return brokers.map((name) => {
      const bObj = stats[name];
      const avg = bObj.count > 0 ? Math.round(bObj.totalMs / bObj.count) : null;
      return { name, avg, count: bObj.count };
    });
  };

  const latencyStats = calculateBrokerLatencyStats();

  const getLogIcon = (type: ActivityLog["type"], status: ActivityLog["status"]) => {
    if (status === "error") return <AlertCircle className="w-4 h-4 text-rose-500" />;
    if (status === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    
    switch (type) {
      case "connection":
        return <Server className="w-4 h-4 text-sky-500" />;
      case "command":
        return <Zap className="w-4 h-4 text-emerald-500" />;
      case "sensor":
        return <Timer className="w-4 h-4 text-indigo-500" />;
      case "voice":
        return <Phone className="w-4 h-4 text-purple-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 shadow-xl rounded-2xl p-6" id="activity-log-viewer">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-850 mb-6">
        <div>
          <h3 className="font-bold text-white tracking-tight text-base">Monitoring Aktivitas & Delay</h3>
          <p className="text-xs text-slate-500">Log sinkronisasi broker dan latensi eksekusi MQTT</p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <ListFilter className="w-3.5 h-3.5 text-slate-500 mr-1" />
          {(["ALL", "CONNECTION", "COMMAND", "SENSOR", "VOICE", "SYSTEM"] as LogFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 cursor-pointer rounded-lg text-xs font-semibold transition ${
                filter === f
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/15"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {f === "ALL" ? "SEMUA" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time MQTT Broker Delay Benchmark Panel */}
      <div className="mb-6 bg-slate-950/60 border border-slate-850 rounded-2xl p-4">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
          <Timer className="w-4 h-4 text-blue-400" />
          Tolok Ukur Delay Broker (MQTT Latency History)
        </h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {latencyStats.map((stat) => (
            <div key={stat.name} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-md">
              <span className="text-xs font-bold text-slate-400">{stat.name}</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                {stat.avg !== null ? (
                  <>
                    <span className="text-2xl font-semibold text-blue-400 tracking-tight">{stat.avg}</span>
                    <span className="text-[10px] text-slate-500 font-mono">ms</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500 italic">Belum ada data</span>
                )}
              </div>
              <span className="text-[9px] text-slate-500 font-mono mt-1">
                Sampel Perintah: {stat.count}x
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-2.5 font-medium leading-relaxed">
          * Latensi dihitung berdasarkan selisih waktu dari perintah dikirim hingga broker mengkonfirmasi data kembali ke dashboard.
        </p>
      </div>

      {/* Log Feed */}
      <div className="overflow-y-auto max-h-[350px] space-y-2 pr-1.5 custom-scrollbar select-text font-sans">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs leading-relaxed transition ${
                log.status === "error"
                  ? "bg-rose-950/30 border-rose-900/40 text-rose-300"
                  : log.status === "warning"
                  ? "bg-amber-950/30 border-amber-900/40 text-amber-300"
                  : "bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-300"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">{getLogIcon(log.type, log.status)}</div>
                <div>
                  <div className="font-semibold text-slate-200">{log.message}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span>•</span>
                    <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-semibold font-sans">
                      {log.broker}
                    </span>
                  </div>
                </div>
              </div>

              {/* Latency Tag */}
              {log.delayMs !== undefined && (
                <div className="flex items-center gap-1 bg-blue-950/45 border border-blue-900/30 text-blue-400 font-bold px-2 py-0.5 rounded-lg text-[10px] font-mono shadow-sm">
                  <span>{log.delayMs} ms</span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-slate-500 text-xs italic bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            Belum ada entri log aktivitas yang terekam.
          </div>
        )}
      </div>
    </div>
  );
}
