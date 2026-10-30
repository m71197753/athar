import type { AppearanceSettings } from "@workspace/api-client-react";

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  primaryColor: "#4338CA",
  accentColor: "#6366F1",
  canvasColor: "#F8FAFC",
  surfaceColor: "#FFFFFF",
  fontFamily: "IBM Plex Sans Arabic",
  fontScale: 100,
  textColor: "#334155",
  headingColor: "#172033",
  cardTextColor: "#334155",
  cardBorderColor: "#E2E8F0",
  welcomeTitle: "ابدأ من هنا واختر مساحتك",
  welcomeDescription: "تعلّم، وثّق ما أنجزته، وخطّط لخطوتك المهنية القادمة من المكان نفسه.",
};

export const PLATFORM_FONTS = {
  "IBM Plex Sans Arabic": "'IBM Plex Sans Arabic', 'Cairo', Arial, sans-serif",
  Cairo: "'Cairo', 'IBM Plex Sans Arabic', Arial, sans-serif",
  Tahoma: "Tahoma, 'IBM Plex Sans Arabic', Arial, sans-serif",
  Arial: "Arial, 'IBM Plex Sans Arabic', sans-serif",
} as const;

export function appearanceContrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const [r, g, b] = rgb(color).map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

export const APPEARANCE_PRESETS: { label: string; value: AppearanceSettings }[] = [
  { label: "هوية أثر", value: DEFAULT_APPEARANCE },
  { label: "أخضر هادئ", value: { ...DEFAULT_APPEARANCE, primaryColor: "#0F766E", accentColor: "#14B8A6", canvasColor: "#F4F8F7" } },
  { label: "أزرق موثوق", value: { ...DEFAULT_APPEARANCE, primaryColor: "#1D4ED8", accentColor: "#3B82F6", canvasColor: "#F4F7FB" } },
  { label: "بنفسجي هادئ", value: { ...DEFAULT_APPEARANCE, primaryColor: "#6D28D9", accentColor: "#8B5CF6", canvasColor: "#F7F5FC" } },
];

function rgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function hex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function mix(color: string, target: string, amount: number) {
  const from = rgb(color), to = rgb(target);
  return hex(from.map((value, index) => value * (1 - amount) + to[index] * amount) as [number, number, number]);
}

function hsl(color: string) {
  const [r8, g8, b8] = rgb(color);
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  const lightness = (max + min) / 2;
  let saturation = 0;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function getAppearanceTextColor(color: string) {
  const [r, g, b] = rgb(color).map(value => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? "#0F172A" : "#FFFFFF";
}

export function getAppearancePrimary(settings: AppearanceSettings, dark = false) {
  return dark ? mix(settings.primaryColor, "#FFFFFF", 0.38) : settings.primaryColor;
}

export function applyPlatformAppearance(settings: AppearanceSettings) {
  const root = document.documentElement.style;
  const font = settings.fontFamily ?? "IBM Plex Sans Arabic";
  root.setProperty("--platform-font-scale", String((settings.fontScale ?? 100) / 100));
  root.setProperty("--platform-font-body", PLATFORM_FONTS[font]);
  root.setProperty("--platform-font-heading", font === "IBM Plex Sans Arabic" ? PLATFORM_FONTS.Cairo : PLATFORM_FONTS[font]);
  root.setProperty("--platform-text-light", settings.textColor ?? "#334155");
  root.setProperty("--platform-heading-light", settings.headingColor ?? "#172033");
  root.setProperty("--platform-card-text-light", settings.cardTextColor ?? settings.textColor ?? "#334155");
  root.setProperty("--platform-card-border-light", settings.cardBorderColor ?? "#E2E8F0");
  root.setProperty("--platform-card-text-dark", getAppearanceTextColor(mix(settings.surfaceColor, "#111827", .82)));
  root.setProperty("--platform-card-border-dark", mix(settings.cardBorderColor ?? "#E2E8F0", "#FFFFFF", .3));
  const primaryDark = getAppearancePrimary(settings, true);
  const accentDark = mix(settings.accentColor, "#FFFFFF", 0.4);
  const deepLight = mix(settings.primaryColor, "#000000", 0.16);
  const deepDark = mix(primaryDark, "#000000", 0.16);
  const paperLight = mix(settings.canvasColor, settings.surfaceColor, 0.5);
  const primarySoftLight = mix(settings.primaryColor, settings.canvasColor, 0.92);
  const primarySoftDark = mix(primaryDark, "#172033", 0.88);

  root.setProperty("--platform-primary-light", settings.primaryColor);
  root.setProperty("--platform-primary-dark", primaryDark);
  root.setProperty("--platform-primary-deep-light", deepLight);
  root.setProperty("--platform-primary-deep-dark", deepDark);
  root.setProperty("--platform-accent-light", settings.accentColor);
  root.setProperty("--platform-accent-dark", accentDark);
  root.setProperty("--platform-primary-soft-light", primarySoftLight);
  root.setProperty("--platform-primary-soft-dark", primarySoftDark);
  root.setProperty("--platform-primary-foreground-light", getAppearanceTextColor(settings.primaryColor));
  root.setProperty("--platform-primary-foreground-dark", getAppearanceTextColor(primaryDark));
  root.setProperty("--platform-primary-foreground-hsl-light", hsl(getAppearanceTextColor(settings.primaryColor)));
  root.setProperty("--platform-primary-foreground-hsl-dark", hsl(getAppearanceTextColor(primaryDark)));
  root.setProperty("--platform-accent-foreground-hsl-light", hsl(getAppearanceTextColor(settings.accentColor)));
  root.setProperty("--platform-accent-foreground-hsl-dark", hsl(getAppearanceTextColor(accentDark)));
  root.setProperty("--platform-primary-hsl-light", hsl(settings.primaryColor));
  root.setProperty("--platform-primary-hsl-dark", hsl(primaryDark));
  root.setProperty("--platform-accent-hsl-light", hsl(settings.accentColor));
  root.setProperty("--platform-accent-hsl-dark", hsl(accentDark));
  root.setProperty("--platform-canvas-light", settings.canvasColor);
  root.setProperty("--platform-paper-light", paperLight);
  root.setProperty("--platform-surface-light", settings.surfaceColor);
  root.setProperty("--platform-canvas-hsl-light", hsl(settings.canvasColor));
  root.setProperty("--platform-surface-hsl-light", hsl(settings.surfaceColor));
}
