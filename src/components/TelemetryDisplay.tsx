import React from "react";
import { Thermometer, Droplet, Clock, ShieldAlert } from "lucide-react";
import { SensorData } from "../types";

interface TelemetryDisplayProps {
  sensor: SensorData;
}

export default function TelemetryDisplay({ sensor }: TelemetryDisplayProps) {
  const { suhu, kelembaban, lastUpdated } = sensor;

  // Percentage calculations for SVG dials
  const tempPercent = Math.min(Math.max((suhu - 15) / (40 - 15), 0), 1) * 100;
  const humPercent = Math.min(Math.max(kelembaban / 100, 0), 1) * 100;

  // Custom stroke dashes for circular gauge dials (radius = 50, circumference = 2 * PI * r = 314)
  const strokeDashTemp = (tempPercent / 100) * 314;
  const strokeDashHum = (humPercent / 100) * 314;

  const getTempSeverity = (t: number) => {
    if (t > 33) return { label: "Suhu Tinggi (Panas)", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" };
    if (t < 20) return { label: "Suhu Rendah (Dingin)", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
    return { label: "Suhu Normal", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  };

  const severity = getTempSeverity(suhu);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="telemetry-display-grid">
      {/* Temperature Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-between min-h-[240px] shadow-xl">
        <div className="w-full flex items-center justify-between text-slate-300 font-semibold text-sm pb-3 border-b border-slate-850">
          <span className="flex items-center gap-1.5 text-orange-400">
            <Thermometer className="w-4 h-4 text-orange-500" />
            Suhu Lingkungan
          </span>
          <span className="text-xs text-slate-500 font-mono">°C (Celsius)</span>
        </div>

        {/* Big Dial */}
        <div className="relative w-32 h-32 flex items-center justify-center my-3">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background Circle */}
            <circle
              cx="60"
              cy="60"
              r="50"
              className="stroke-slate-800 fill-none"
              strokeWidth="8"
            />
            {/* Animated Gauge Circle */}
            <circle
              cx="60"
              cy="60"
              r="50"
              className="stroke-orange-500 fill-none transition-all duration-500"
              strokeWidth="8"
              strokeDasharray="314"
              strokeDashoffset={314 - strokeDashTemp}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-3.5xl font-light text-white tracking-tight font-sans">
              {suhu.toFixed(1)}
            </span>
            <span className="text-lg font-normal text-slate-400 align-super">°C</span>
          </div>
        </div>

        {/* Severity Banner */}
        <div className={`w-full text-center py-2 px-3 rounded-xl border text-xs font-semibold ${severity.color}`}>
          {severity.label}
        </div>
      </div>

      {/* Humidity Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-between min-h-[240px] shadow-xl">
        <div className="w-full flex items-center justify-between text-slate-300 font-semibold text-sm pb-3 border-b border-slate-850">
          <span className="flex items-center gap-1.5 text-blue-400">
            <Droplet className="w-4 h-4 text-blue-400" />
            Kelembaban Udara
          </span>
          <span className="text-xs text-slate-500 font-mono">% (RH)</span>
        </div>

        {/* Big Dial */}
        <div className="relative w-32 h-32 flex items-center justify-center my-3">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background Circle */}
            <circle
              cx="60"
              cy="60"
              r="50"
              className="stroke-slate-800 fill-none"
              strokeWidth="8"
            />
            {/* Animated Gauge Circle */}
            <circle
              cx="60"
              cy="60"
              r="50"
              className="stroke-blue-500 fill-none transition-all duration-500"
              strokeWidth="8"
              strokeDasharray="314"
              strokeDashoffset={314 - strokeDashHum}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-3.5xl font-light text-white tracking-tight font-sans">
              {kelembaban.toFixed(0)}
            </span>
            <span className="text-lg font-normal text-slate-400 align-super">%</span>
          </div>
        </div>

        {/* Timestamp Footer */}
        <div className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 font-mono py-2 bg-slate-950/40 rounded-xl border border-slate-850">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Update: {new Date(lastUpdated).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
