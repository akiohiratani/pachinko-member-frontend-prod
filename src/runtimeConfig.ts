export type RuntimeConfig = {
  websocketUrl: string;
};

let runtimeConfig: RuntimeConfig | null = null;
let initialized = false;

export async function initRuntimeConfig(): Promise<RuntimeConfig | null> {
  if (initialized) {
    return runtimeConfig;
  }

  initialized = true;
  try {
    const response = await fetch("/runtime-config.sample.json", { cache: "no-store" });
    if (!response.ok) {
      console.warn(`Failed to load runtime config: ${response.status}`);
      return null;
    }

    runtimeConfig = (await response.json()) as RuntimeConfig;
    return runtimeConfig;
  } catch (error) {
    console.warn("Failed to load runtime config", error);
    return null;
  }
}

export function getRuntimeConfig(): RuntimeConfig | null {
  return runtimeConfig;
}
