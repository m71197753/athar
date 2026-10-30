import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import "./named-color-picker.css";

export const NAMED_COLORS = [
  { name: "أبيض", value: "#FFFFFF" },
  { name: "أزرق ثلجي", value: "#F5F9FC" },
  { name: "أخضر ثلجي", value: "#F5FAF6" },
  { name: "رمادي فاتح", value: "#E8EDF4" },
  { name: "أسود فحمي", value: "#111827" },
  { name: "فحمي", value: "#1F2937" },
  { name: "رمادي داكن", value: "#303746" },
  { name: "رمادي", value: "#64748B" },
  { name: "أزرق داكن", value: "#27384B" },
  { name: "كحلي", value: "#163D62" },
  { name: "أزرق", value: "#2877A8" },
  { name: "سماوي", value: "#2EAED9" },
  { name: "أخضر داكن", value: "#1E4938" },
  { name: "أخضر رمادي", value: "#293B32" },
  { name: "أخضر", value: "#38856B" },
  { name: "نيلي أثر", value: "#5147C8" },
  { name: "بنفسجي", value: "#6D5BD0" },
  { name: "وردي", value: "#D95E91" },
  { name: "برتقالي", value: "#E88735" },
  { name: "أحمر", value: "#C94A4A" },
  { name: "ذهبي", value: "#E4B62F" },
  { name: "أصفر فاتح", value: "#FFF3A6" },
] as const;

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId: string;
};

export function NamedColorPicker({ label, value, onChange, testId }: Props) {
  const [open, setOpen] = useState(false);
  const selectedColor = NAMED_COLORS.find((color) => color.value.toLowerCase() === value.toLowerCase());
  const currentName = selectedColor?.name ?? "لون محفوظ";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="named-color-trigger"
          aria-label={`${label}: ${currentName}`}
          aria-expanded={open}
          data-testid={testId}
        >
          <span className="named-color-dot" style={{ backgroundColor: value }} aria-hidden="true" />
          <span>{currentName}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="named-color-popover" sideOffset={7} align="start" dir="rtl">
          <div className="named-color-heading">{`اختر ${label}`}</div>
          <div className="named-color-options" role="group" aria-label={`ألوان ${label}`}>
            {NAMED_COLORS.map((color) => {
              const selected = color.value.toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={color.value}
                  type="button"
                  className={`named-color-option${selected ? " is-selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(color.value);
                    setOpen(false);
                  }}
                  data-testid={`${testId}-${color.value.slice(1).toLowerCase()}`}
                >
                  <span className="named-color-dot" style={{ backgroundColor: color.value }} aria-hidden="true" />
                  <span>{color.name}</span>
                  {selected && <Check size={14} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {!selectedColor && <div className="named-color-current">اللون الحالي: {value}</div>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
