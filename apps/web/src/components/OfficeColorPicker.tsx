import {
  OFFICE_COLORS,
  applyOfficeColor,
  readOfficeColor,
  type OfficeColorId,
} from "../lib/office-color";

export function OfficeColorPicker(props: {
  value?: OfficeColorId;
  onChange?: (id: OfficeColorId) => void;
}) {
  const value = props.value ?? readOfficeColor();

  return (
    <div className="office-color-hues" role="radiogroup" aria-label="Office color">
      {OFFICE_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          role="radio"
          aria-checked={value === color.id}
          aria-label={color.label}
          title={color.label}
          className={`office-color-hue${value === color.id ? " on" : ""}`}
          style={{ background: color.swatch }}
          onClick={() => {
            applyOfficeColor(color.id);
            props.onChange?.(color.id);
          }}
        />
      ))}
    </div>
  );
}
