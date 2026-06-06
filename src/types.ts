export interface BrokerConfig {
  id: number;
  nama: string;
  server: string;
  port: number;
  user: string;
  pass: string;
  clientId: string;
  useTLS: boolean;
}

export interface RelayState {
  relay1: boolean;
  relay2: boolean;
  relay3: boolean;
  relay4: boolean;
}

export interface SensorData {
  suhu: number;
  kelembaban: number;
  lastUpdated: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: "connection" | "command" | "sensor" | "voice" | "system";
  message: string;
  broker: string;
  status: "success" | "error" | "info" | "warning";
  delayMs?: number;
}

export interface AppState {
  activeBroker: number;
  relays: RelayState;
  sensor: SensorData;
  variasi1: boolean;
  variasi2: boolean;
  isSimulatedEspEnabled: boolean;
}

export const BROKER_LIST: BrokerConfig[] = [
  {
    id: 1,
    nama: "CloudAMQP",
    server: "kingfisher.lmq.cloudamqp.com",
    port: 8883,
    user: "azfrfvzw:azfrfvzw",
    pass: "HMxpFwhwM9i7bDo2bp8XoBipnq2ZcmxQ",
    clientId: "ESP_CloudAMQP",
    useTLS: true,
  },
  {
    id: 2,
    nama: "Cedalo",
    server: "pf-26xt4cmufmfw6kr1zpyq.cedalo.cloud",
    port: 8883,
    user: "Esp2",
    pass: "d",
    clientId: "Esp32Client",
    useTLS: true,
  },
  {
    id: 3,
    nama: "Flespi",
    server: "mqtt.flespi.io",
    port: 8883,
    user: "UJyFksta5S1kfEMf95YVPQIn0X2o9u4OFvWvVeAMuGEORyCzS5elmDywO9xhS5ay",
    pass: "",
    clientId: "ESP32Flespi001",
    useTLS: true,
  },
];
