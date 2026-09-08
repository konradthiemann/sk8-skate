import { createContext } from "react";
import type { TelemetryClient } from "./client";

export const TelemetryContext = createContext<TelemetryClient | null>(null);
