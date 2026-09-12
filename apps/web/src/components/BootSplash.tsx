import { MascotMark, type MascotShape } from "@groxbot/mascot";

/** Three teammates, not a personal mark — the office walking in. */
export const BOOT_TEAM: readonly {
  name: string;
  color: string;
  shape: MascotShape;
}[] = [
  { name: "Ada", color: "#e45c9a", shape: "circle" },
  { name: "Sam", color: "#5b7cff", shape: "squircle" },
  { name: "Kai", color: "#2f9e6d", shape: "hex" },
];

export function BootSplash(props: { embed?: boolean }) {
  return (
    <div
      className={
        props.embed ? "boot-splash boot-splash-embed" : "screen boot-splash"
      }
      data-boot-splash
      role="status"
      aria-label="Opening Groxbot"
    >
      <div className="boot-mark">
        <div className="boot-faces" aria-hidden>
          {BOOT_TEAM.map((face) => (
            <span key={face.name} className="boot-face">
              <MascotMark
                name={face.name}
                color={face.color}
                shape={face.shape}
                mood="idle"
                size="sm"
              />
            </span>
          ))}
        </div>
        <p className="boot-word">Groxbot</p>
      </div>
    </div>
  );
}
