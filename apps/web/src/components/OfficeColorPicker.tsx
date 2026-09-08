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
          style={{ background: color.rail }}
          onClick={() => {
            applyOfficeColor(color.id);
            props.onChange?.(color.id);
          }}
        />
      ))}
    </div>
  );
}

export function OfficeLookList(props: {
  value?: OfficeColorId;
  onChange?: (id: OfficeColorId) => void;
}) {
  const value = props.value ?? readOfficeColor();

  return (
    <div className="office-looks" role="radiogroup" aria-label="Office look">
      {OFFICE_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          role="radio"
          aria-checked={value === color.id}
          className={`office-look${value === color.id ? " on" : ""}`}
          onClick={() => {
            applyOfficeColor(color.id);
            props.onChange?.(color.id);
          }}
        >
          <span className="office-look-swatch" aria-hidden>
            <i style={{ background: color.rail }} />
            <i style={{ background: color.swatch }} />
          </span>
          <span className="office-look-copy">
            <strong>{color.label}</strong>
            <span className="muted">{color.blurb}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
