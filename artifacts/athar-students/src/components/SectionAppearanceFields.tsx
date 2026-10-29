import type { CSSProperties } from "react";
import {
  getSectionAccent,
  getSectionIcon,
  SECTION_ACCENT_OPTIONS,
  SECTION_CARD_STYLE_OPTIONS,
  SECTION_ICON_OPTIONS,
  type SectionAccentKey,
  type SectionCardStyle,
  type SectionIconKey,
} from "../lib/section-appearance";

type Props = {
  iconKey: SectionIconKey;
  accentKey: SectionAccentKey;
  cardStyle: SectionCardStyle;
  onIconChange: (value: SectionIconKey) => void;
  onAccentChange: (value: SectionAccentKey) => void;
  onCardStyleChange: (value: SectionCardStyle) => void;
  previewTitle: string;
};

export function SectionAppearanceFields({
  iconKey, accentKey, cardStyle, onIconChange, onAccentChange, onCardStyleChange, previewTitle,
}: Props) {
  const Icon = getSectionIcon(iconKey);
  const accent = getSectionAccent(accentKey);
  return <div className="adm-section-appearance" aria-label="مظهر القسم">
    <div className="adm-section-appearance-fields">
      <label className="adm-field">
        <span>أيقونة القسم</span>
        <select value={iconKey} onChange={event => onIconChange(event.target.value as SectionIconKey)}>
          {SECTION_ICON_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="adm-field">
        <span>لون القسم</span>
        <span className="adm-accent-select-wrap">
          <i aria-hidden="true" style={{ background: accent.color }}/>
          <select value={accentKey} onChange={event => onAccentChange(event.target.value as SectionAccentKey)}>
            {SECTION_ACCENT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </span>
      </label>
      <label className="adm-field">
        <span>شكل البطاقة</span>
        <select value={cardStyle} onChange={event => onCardStyleChange(event.target.value as SectionCardStyle)}>
          {SECTION_CARD_STYLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
    <div className={`adm-section-appearance-preview card-style-${cardStyle}`} style={{ "--feature-accent": accent.color, "--feature-soft": accent.soft } as CSSProperties}>
      <span><Icon size={18}/></span><b>{previewTitle.trim() || "معاينة القسم"}</b><small>{accent.label} · {SECTION_CARD_STYLE_OPTIONS.find(option => option.value === cardStyle)?.label}</small>
    </div>
  </div>;
}
