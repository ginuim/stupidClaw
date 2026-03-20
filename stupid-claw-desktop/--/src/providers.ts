import providersData from "./providers.json";

export type Provider = (typeof providersData)[number];

export const PROVIDERS: readonly Provider[] = providersData;

export type UserProviderConfig = {
  id: string;
  providerValue: string;
  apiKey: string;
  baseUrl?: string;
  selectedModel: string;
};

export type AppConfig = {
  providers: UserProviderConfig[];
  activeProviderId: string | null;
  port: string;
};

export function getProviderDef(value: string): Provider | undefined {
  return PROVIDERS.find((p) => p.value === value);
}

export function getProviderModels(providerValue: string): { value: string; name: string }[] {
  const provider = getProviderDef(providerValue);
  return provider?.models || [];
}

export function createDefaultConfig(): AppConfig {
  return {
    providers: [],
    activeProviderId: null,
    port: "8080",
  };
}

export function createProviderConfig(providerValue: string): UserProviderConfig {
  const provider = getProviderDef(providerValue);
  const models = getProviderModels(providerValue);

  return {
    id: `provider_${Date.now()}`,
    providerValue,
    apiKey: "",
    baseUrl: provider?.defaultBaseUrl || "",
    selectedModel: models.length > 0 ? models[0].value : "",
  };
}