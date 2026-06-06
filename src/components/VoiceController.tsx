import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, HelpCircle } from "lucide-react";

interface VoiceControllerProps {
  onSendRelay: (relay: string, state: "ON" | "OFF") => void;
  onSendVariasi: (variasi: number, state: "START" | "STOP") => void;
  onSetBroker: (id: number) => void;
  suhu: number;
  kelembaban: number;
  activeBrokerName: string;
  wsSendLog: (phrase: string, reply: string, status: "success" | "warning" | "error") => void;
}

export default function VoiceController({
  onSendRelay,
  onSendVariasi,
  onSetBroker,
  suhu,
  kelembaban,
  activeBrokerName,
  wsSendLog,
}: VoiceControllerProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check Speech Recognition support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg("Browser Anda tidak mendukung Web Speech Recognition API.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "id-ID"; // Set to Indonesian

    rec.onstart = () => {
      setIsListening(true);
      setErrorMsg("");
      setFeedback("Mendengarkan... Silakan ucapkan perintah Anda.");
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = (e: any) => {
      console.error("Speech Recognition Error", e);
      if (e.error === "not-allowed") {
        setErrorMsg("Izin mikrofon ditolak. Periksa pengaturan izin browser.");
      } else {
        setErrorMsg(`Kesalahan suara: ${e.error}`);
      }
      setIsListening(false);
    };

    rec.onresult = (event: any) => {
      const resultIndex = event.resultIndex;
      const text = event.results[resultIndex][0].transcript.toLowerCase().trim();
      setTranscript(text);
      processCommand(text);
    };

    recognitionRef.current = rec;
  }, [suhu, kelembaban, activeBrokerName]);

  const speak = (message: string) => {
    if (!window.speechSynthesis) return;
    
    // Stop previous speaks
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "id-ID"; // Indonesian feedback voice
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Find an Indonesian voice if available
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.startsWith("id"));
    if (idVoice) {
      utterance.voice = idVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  const processCommand = (phrase: string) => {
    setFeedback(`Memproses perintah: "${phrase}"`);
    let reply = "";
    let status: "success" | "warning" | "error" = "success";

    // 1. Temperature Enquiry
    if (phrase.includes("suhu") || phrase.includes("temperatur")) {
      reply = `Suhu saat ini terpantau sebesar ${suhu.toFixed(1)} derajat Celcius.`;
      speak(reply);
      wsSendLog(phrase, reply, "success");
      return;
    }

    // 2. Humidity Enquiry
    if (phrase.includes("kelembaban") || phrase.includes("kelembapan") || phrase.includes("basah")) {
      reply = `Kelembaban udara saat ini adalah ${kelembaban.toFixed(1)} persen.`;
      speak(reply);
      wsSendLog(phrase, reply, "success");
      return;
    }

    // 3. Status Enquiry
    if (phrase.includes("status") || phrase.includes("broker")) {
      reply = `Sistem terhubung menggunakan broker ${activeBrokerName}.`;
      speak(reply);
      wsSendLog(phrase, reply, "success");
      return;
    }

    // 4. Broker Switching
    if (phrase.includes("pindah") || phrase.includes("ganti") || phrase.includes("ubah")) {
      if (phrase.includes("broker satu") || phrase.includes("satu") || phrase.includes("cloudamqp")) {
        onSetBroker(1);
        reply = "Memindahkan koneksi aktif ke broker satu, CloudAMQP.";
        speak(reply);
        wsSendLog(phrase, reply, "success");
        return;
      }
      if (phrase.includes("broker dua") || phrase.includes("dua") || phrase.includes("cedalo")) {
        onSetBroker(2);
        reply = "Memindahkan koneksi aktif ke broker dua, Cedalo Cloud.";
        speak(reply);
        wsSendLog(phrase, reply, "success");
        return;
      }
      if (phrase.includes("broker tiga") || phrase.includes("tiga") || phrase.includes("flespi")) {
        onSetBroker(3);
        reply = "Memindahkan koneksi aktif ke broker tiga, Flespi.";
        speak(reply);
        wsSendLog(phrase, reply, "success");
        return;
      }
    }

    // 5. Turn On All Relays
    if (
      (phrase.includes("hidupkan") || phrase.includes("nyalakan") || phrase.includes("aktifkan")) &&
      phrase.includes("semua")
    ) {
      onSendRelay("relay1", "ON");
      onSendRelay("relay2", "ON");
      onSendRelay("relay3", "ON");
      onSendRelay("relay4", "ON");
      reply = "Menyalakan seluruh saluran relay.";
      speak(reply);
      wsSendLog(phrase, reply, "success");
      return;
    }

    // 6. Turn Off All Relays
    if (
      (phrase.includes("matikan") || phrase.includes("nonaktifkan")) &&
      phrase.includes("semua")
    ) {
      onSendRelay("relay1", "OFF");
      onSendRelay("relay2", "OFF");
      onSendRelay("relay3", "OFF");
      onSendRelay("relay4", "OFF");
      reply = "Mematikan seluruh saluran relay.";
      speak(reply);
      wsSendLog(phrase, reply, "success");
      return;
    }

    // 7. Individual Relay Controls (Nyala / Aktifkan / Hidupkan)
    const onKeywords = ["nyalakan", "hidupkan", "aktifkan", "buka"];
    const offKeywords = ["matikan", "nonaktifkan", "tutup"];

    const matchOn = onKeywords.some((keyword) => phrase.includes(keyword));
    const matchOff = offKeywords.some((keyword) => phrase.includes(keyword));

    if (matchOn || matchOff) {
      let rTarget = "";
      let rName = "";

      if (phrase.includes("relay 1") || phrase.includes("relay satu") || phrase.includes("saklar 1") || phrase.includes("saklar satu")) {
        rTarget = "relay1";
        rName = "Relay Satu";
      } else if (phrase.includes("relay 2") || phrase.includes("relay dua") || phrase.includes("saklar 2") || phrase.includes("saklar dua")) {
        rTarget = "relay2";
        rName = "Relay Dua";
      } else if (phrase.includes("relay 3") || phrase.includes("relay tiga") || phrase.includes("saklar 3") || phrase.includes("saklar tiga")) {
        rTarget = "relay3";
        rName = "Relay Tiga";
      } else if (phrase.includes("relay 4") || phrase.includes("relay empat") || phrase.includes("saklar 4") || phrase.includes("saklar empat")) {
        rTarget = "relay4";
        rName = "Relay Empat";
      }

      if (rTarget) {
        if (matchOn) {
          onSendRelay(rTarget, "ON");
          reply = `${rName} telah dinyalakan.`;
          speak(reply);
          wsSendLog(phrase, reply, "success");
          return;
        } else {
          onSendRelay(rTarget, "OFF");
          reply = `${rName} telah dimatikan.`;
          speak(reply);
          wsSendLog(phrase, reply, "success");
          return;
        }
      }
    }

    // 8. Variations Controls
    if (phrase.includes("variasi")) {
      if (phrase.includes("satu") || phrase.includes("1")) {
        if (phrase.includes("mulai") || phrase.includes("start") || phrase.includes("jalankan") || phrase.includes("nyalakan")) {
          onSendVariasi(1, "START");
          reply = "Memulai variasi satu, relay running maju.";
          speak(reply);
          wsSendLog(phrase, reply, "success");
          return;
        } else if (phrase.includes("stop") || phrase.includes("berhenti") || phrase.includes("matikan") || phrase.includes("hentikan")) {
          onSendVariasi(1, "STOP");
          reply = "Menonaktifkan variasi satu.";
          speak(reply);
          wsSendLog(phrase, reply, "success");
          return;
        }
      }
      if (phrase.includes("dua") || phrase.includes("2")) {
        if (phrase.includes("mulai") || phrase.includes("start") || phrase.includes("jalankan") || phrase.includes("nyalakan")) {
          onSendVariasi(2, "START");
          reply = "Memulai variasi dua, relay running mundur.";
          speak(reply);
          wsSendLog(phrase, reply, "success");
          return;
        } else if (phrase.includes("stop") || phrase.includes("berhenti") || phrase.includes("matikan") || phrase.includes("hentikan")) {
          onSendVariasi(2, "STOP");
          reply = "Menonaktifkan variasi dua.";
          speak(reply);
          wsSendLog(phrase, reply, "success");
          return;
        }
      }
      if (phrase.includes("stop") || phrase.includes("berhenti") || phrase.includes("matikan") || phrase.includes("hentikan")) {
        onSendVariasi(1, "STOP");
        onSendVariasi(2, "STOP");
        reply = "Semua program perulangan variasi dihentikan.";
        speak(reply);
        wsSendLog(phrase, reply, "success");
        return;
      }
    }

    // Command didn't match any templates
    reply = "Perintah tidak dimengerti. Silakan coba perintah lain.";
    setFeedback(reply);
    wsSendLog(phrase, reply, "warning");
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setFeedback("Perekaman dihentikan.");
    } else {
      // Prompt voices array load (browser requires user gestures sometimes)
      try {
        window.speechSynthesis.getVoices();
      } catch (e) {}

      recognitionRef.current.start();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 shadow-xl rounded-2xl p-6 relative overflow-hidden" id="voice-controller-panel">
      {/* Absolute faint background mic circle */}
      <div className="absolute -right-4 -bottom-4 text-blue-500/10 pointer-events-none">
        <Mic className="w-32 h-32" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl transition-all ${isListening ? "bg-blue-600 text-white animate-pulse" : "bg-slate-800 text-slate-400 border border-slate-700"}`}>
            <Volume2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white tracking-tight">Perintah Kontrol Suara</h3>
            <p className="text-xs text-slate-500">Gunakan mic untuk kendali suara cerdas</p>
          </div>
        </div>

        <button
          onClick={toggleListening}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition cursor-pointer text-sm shadow-md ${
            isListening
              ? "bg-rose-650 hover:bg-rose-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
          id="btn-voice-mic"
        >
          {isListening ? (
            <>
              <MicOff className="w-4 h-4" />
              <span>Matikan Mic</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Aktifkan Mic</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-450 text-xs px-3 py-2 rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Voice Status Waves */}
      <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-850 min-h-[90px] flex flex-col justify-center">
        {isListening && (
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="h-4 w-1 bg-blue-500 rounded-full animate-bounce"></span>
            <span className="h-6 w-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.15s]"></span>
            <span className="h-3 w-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.3s]"></span>
            <span className="h-5 w-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.45s]"></span>
            <span className="h-2 w-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.6s]"></span>
          </div>
        )}
        
        <div className="text-sm font-medium text-slate-300">
          {transcript ? (
            <span className="text-white italic">"{transcript}"</span>
          ) : (
            <span className="text-slate-500 italic">Ucapkan perintah dalam bahasa Indonesia...</span>
          )}
        </div>

        {feedback && (
          <div className="text-xs text-blue-400 mt-1 font-mono">{feedback}</div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-850 pt-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2 font-medium">
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>Contoh Perintah Suara yang dapat diucapkan:</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
          <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-2 hover:bg-slate-800 hover:text-white transition cursor-pointer" onClick={() => processCommand("sebutkan suhu sekarang")}>
            "Berapa suhu sekarang?"
          </div>
          <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-2 hover:bg-slate-800 hover:text-white transition cursor-pointer" onClick={() => processCommand("nyalakan relay satu")}>
            "Nyalakan relay 1"
          </div>
          <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-2 hover:bg-slate-800 hover:text-white transition cursor-pointer" onClick={() => processCommand("matikan semua relay")}>
            "Matikan semua relay"
          </div>
          <div className="bg-slate-950/40 border border-slate-850 rounded-lg p-2 hover:bg-slate-800 hover:text-white transition cursor-pointer" onClick={() => processCommand("jalankan variasi satu")}>
            "Mulai variasi 1"
          </div>
        </div>
      </div>
    </div>
  );
}
