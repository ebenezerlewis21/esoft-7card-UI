import AsyncStorage from "@react-native-async-storage/async-storage";
import { type ShopCatalogItem, type UserShopItem } from "./auth";

export type AppThemeId = string;

export type AppTheme = {
  id: AppThemeId;
  name: string;
  description: string;
  accent: string;
  icon: "cards-playing-outline" | "weather-night" | "weather-sunset" | "palette-outline";
  colors: {
    screenBackground: string;
    panelBackground: string;
    settingsBackground: string;
    previewBackground: string;
  };
};

const ACTIVE_APP_THEME_KEY = "@settings/activeAppTheme";

export const DEFAULT_APP_THEME: AppTheme = {
  id: "classic",
  name: "Classic Table",
  description: "Felt green and gold.",
  accent: "#f6d43a",
  icon: "cards-playing-outline",
  colors: {
    screenBackground: "#1a5c2e",
    panelBackground: "rgba(0,0,0,0.28)",
    settingsBackground: "#173f2f",
    previewBackground: "#1f6f3a",
  },
};

let activeAppTheme: AppTheme = DEFAULT_APP_THEME;
let hydratePromise: Promise<void> | null = null;
const appThemeListeners = new Set<() => void>();

const stringProperty = (
  properties: Record<string, unknown> | undefined,
  key: string,
): string | null => {
  const value = properties?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const toThemeIcon = (
  value: string | null,
): AppTheme["icon"] => {
  if (
    value === "cards-playing-outline" ||
    value === "weather-night" ||
    value === "weather-sunset" ||
    value === "palette-outline"
  ) {
    return value;
  }

  return "palette-outline";
};

export const appThemeFromShopItem = (
  item: ShopCatalogItem | UserShopItem,
): AppTheme | null => {
  if (item.type !== "GAME_THEME") return null;

  const uiId = stringProperty(item.properties, "uiId");
  if (!uiId) return null;

  return {
    id: uiId,
    name: item.name,
    description:
      stringProperty(item.properties, "description") ??
      "Theme for lobby and shop screens.",
    accent: stringProperty(item.properties, "accent") ?? DEFAULT_APP_THEME.accent,
    icon: toThemeIcon(stringProperty(item.properties, "icon")),
    colors: {
      screenBackground:
        stringProperty(item.properties, "screenBackground") ??
        DEFAULT_APP_THEME.colors.screenBackground,
      panelBackground:
        stringProperty(item.properties, "panelBackground") ??
        DEFAULT_APP_THEME.colors.panelBackground,
      settingsBackground:
        stringProperty(item.properties, "settingsBackground") ??
        DEFAULT_APP_THEME.colors.settingsBackground,
      previewBackground:
        stringProperty(item.properties, "previewBackground") ??
        DEFAULT_APP_THEME.colors.previewBackground,
    },
  };
};

const normalizeStoredTheme = (value: unknown): AppTheme | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<AppTheme>;
  const colors = candidate.colors;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.description !== "string" ||
    typeof candidate.accent !== "string" ||
    !colors ||
    typeof colors.screenBackground !== "string" ||
    typeof colors.panelBackground !== "string" ||
    typeof colors.settingsBackground !== "string" ||
    typeof colors.previewBackground !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    description: candidate.description,
    accent: candidate.accent,
    icon: toThemeIcon(candidate.icon ?? null),
    colors: {
      screenBackground: colors.screenBackground,
      panelBackground: colors.panelBackground,
      settingsBackground: colors.settingsBackground,
      previewBackground: colors.previewBackground,
    },
  };
};

export const getActiveAppThemeId = (): AppThemeId => activeAppTheme.id;

export const getActiveAppTheme = (): AppTheme => activeAppTheme;

export const subscribeAppThemeSettings = (listener: () => void): (() => void) => {
  appThemeListeners.add(listener);
  return () => {
    appThemeListeners.delete(listener);
  };
};

export const setActiveAppTheme = (theme: AppTheme): void => {
  activeAppTheme = theme;
  appThemeListeners.forEach((listener) => listener());

  void AsyncStorage.setItem(ACTIVE_APP_THEME_KEY, JSON.stringify(theme));
};

const loadAppThemeSettings = async (): Promise<void> => {
  try {
    const rawTheme = await AsyncStorage.getItem(ACTIVE_APP_THEME_KEY);
    if (rawTheme) {
      const parsed = normalizeStoredTheme(JSON.parse(rawTheme));
      if (parsed) {
        activeAppTheme = parsed;
      }
    }
  } catch {
    // Keep default theme when storage is unavailable or malformed.
  }

  appThemeListeners.forEach((listener) => listener());
};

export const initializeAppThemeSettings = (): Promise<void> => {
  if (!hydratePromise) {
    hydratePromise = loadAppThemeSettings();
  }

  return hydratePromise;
};
