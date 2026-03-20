import providersData from "./providers.json";

export type InitProvider = (typeof providersData)[number];

export type ProviderValue = InitProvider["value"];

export const PROVIDERS: readonly InitProvider[] = providersData;