import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeftToLineIcon,
  ArrowReloadHorizontalIcon,
  ArrowRightDoubleIcon,
  BotIcon as BotGlyph,
  Cancel01Icon,
  CancelCircleIcon,
  ChevronDownIcon as ChevronDownGlyph,
  ChevronLeftIcon as ChevronLeftGlyph,
  ChevronRightIcon as ChevronRightGlyph,
  ComputerIcon,
  Copy01Icon,
  Delete02Icon,
  Download01Icon,
  File01Icon,
  FileAudioIcon as FileAudioGlyph,
  FilterIcon as FilterGlyph,
  Folder01Icon,
  FolderOpenIcon as FolderOpenGlyph,
  GithubIcon,
  HierarchyIcon,
  Image01Icon,
  ImageNotFoundIcon,
  InboxDownloadIcon,
  Loading03Icon,
  Logout01Icon,
  Mic01Icon,
  MoreHorizontalIcon,
  Note01Icon,
  PencilEdit01Icon,
  PinIcon as PinGlyph,
  PlayIcon as PlayGlyph,
  SearchIcon as SearchGlyph,
  Share08Icon,
  ShieldAlertIcon,
  SourceCodeIcon,
  SquareIcon as SquareGlyph,
  Tick01Icon,
  Upload01Icon,
  UserGroupIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { ReactNode, SVGProps } from "react";
import { computerFileKind } from "../lib/computer-preview";
import { cn } from "../ui";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & {
  size?: number | string;
  strokeWidth?: number;
};

function OfficeSvg(
  props: IconProps & { kind: string; children: ReactNode },
) {
  const { kind, size = 18, strokeWidth = 1.5, className, children, ...rest } =
    props;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden
      className={cn("office-ico", `ico-${kind}`, className)}
      {...rest}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
    </svg>
  );
}

function Glyph(
  props: IconProps & {
    icon: IconSvgElement;
    altIcon?: IconSvgElement;
    showAlt?: boolean;
  },
) {
  const {
    icon,
    altIcon,
    showAlt,
    size = 18,
    strokeWidth = 1.5,
    ...rest
  } = props;
  return (
    <HugeiconsIcon
      icon={icon}
      altIcon={altIcon}
      showAlt={showAlt}
      size={size}
      color="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden
      {...rest}
    />
  );
}

/** Two strokes, same weight as Plus — not Hugeicons’ fat rounded pause bars. */
const PauseBars: IconSvgElement = [
  [
    "path",
    {
      d: "M9 6v12",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeWidth: "1.5",
      key: "0",
    },
  ],
  [
    "path",
    {
      d: "M15 6v12",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeWidth: "1.5",
      key: "1",
    },
  ],
];

export function SearchIcon(props: IconProps) {
  return <Glyph icon={SearchGlyph} {...props} />;
}

export function PlusIcon(props: IconProps) {
  return (
    <OfficeSvg kind="plus" {...props}>
      <path className="bar-v" d="M12 4V20" />
      <path className="bar-h" d="M20 12H4" />
    </OfficeSvg>
  );
}

export function PauseIcon(props: IconProps) {
  return <Glyph icon={PauseBars} {...props} />;
}

export function PlayIcon(props: IconProps) {
  return <Glyph icon={PlayGlyph} {...props} />;
}

export function PlugIcon(props: IconProps) {
  return (
    <OfficeSvg kind="plug" {...props}>
      <g className="prongs">
        <path d="M15.5 2V6M8.5 6V2" />
      </g>
      <g className="body">
        <path d="M6.00446 7.61331C5.93719 6.74273 6.63957 6 7.53014 6H16.4699C17.3604 6 18.0628 6.74273 17.9955 7.61331L17.8117 9.99197C17.6796 11.7019 17.1011 13.3498 16.132 14.7773L15.5312 15.6622C14.9638 16.4979 14.0077 17 12.9838 17H11.0162C9.99228 17 9.03617 16.4979 8.46881 15.6622L7.86803 14.7773C6.89885 13.3498 6.32041 11.7019 6.18827 9.99197L6.00446 7.61331Z" />
        <path d="M11 9H13" />
      </g>
      <path className="cord" d="M12 17V22" />
      <circle
        className="spark"
        cx="12"
        cy="21.2"
        r="1.15"
        fill="currentColor"
        stroke="none"
      />
    </OfficeSvg>
  );
}

export function BotIcon(props: IconProps) {
  return <Glyph icon={BotGlyph} {...props} />;
}

export function KnowledgeIcon(props: IconProps) {
  return (
    <OfficeSvg kind="knowledge" {...props}>
      <path
        className="book"
        d="M20.9998 16H4.89113C4.40355 16 4.0423 16.1723 3.75757 16.4515C3.28913 16.9108 3.12083 17.5901 3.04657 18.2429C2.96065 18.9982 2.99167 19.6886 3.20248 20.4377C3.43762 21.2734 4.02149 22 4.88667 22H20.9998M19.4061 22C17.8674 20.5885 17.2354 18.1421 19.4061 16"
      />
      <g className="sprout">
        <path d="M11.8176 6.5C11.8176 4 9.10929 3 9.10929 3M11.8176 6.92131C11.8176 6.92131 5.85938 3.85577 5.85938 8.90819C5.85938 13.9606 8.57044 16 9.65094 16C10.5128 16 11.0212 14.9913 11.8176 14.9913C12.6139 14.9913 12.9008 16 13.9841 16C15.0647 16 17.7757 13.9606 17.7757 8.90819C17.7757 3.85578 11.8176 6.92131 11.8176 6.92131ZM12.3593 6C12.3593 2.01035 14.3103 3 15.2858 2C16.2614 4.5 14.9556 5.00259 12.3593 6Z" />
      </g>
    </OfficeSvg>
  );
}

export function SkillsIcon(props: IconProps) {
  return (
    <OfficeSvg kind="skills" {...props}>
      <path
        className="mark"
        d="M4 17.9808V9.70753C4 6.07416 4 4.25748 5.17157 3.12874C6.34315 2 8.22876 2 12 2C15.7712 2 17.6569 2 18.8284 3.12874C20 4.25748 20 6.07416 20 9.70753V17.9808C20 20.2867 20 21.4396 19.2272 21.8523C17.7305 22.6514 14.9232 19.9852 13.59 19.1824C12.8168 18.7168 12.4302 18.484 12 18.484C11.5698 18.484 11.1832 18.7168 10.41 19.1824C9.0768 19.9852 6.26947 22.6514 4.77285 21.8523C4 21.4396 4 20.2867 4 17.9808Z"
      />
      <path className="ridge" d="M4 7H20" />
    </OfficeSvg>
  );
}

export function BoardIcon(props: IconProps) {
  return (
    <OfficeSvg kind="board" {...props}>
      <rect className="col col-a" x="3.5" y="4" width="5" height="16" rx="1" />
      <rect className="col col-b" x="9.5" y="4" width="5" height="10" rx="1" />
      <rect className="col col-c" x="15.5" y="4" width="5" height="13" rx="1" />
    </OfficeSvg>
  );
}

/** Stacked rows — list view of the same work rooms. */
const ListRows: IconSvgElement = [
  [
    "path",
    {
      d: "M4 7h16",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeWidth: "1.5",
      key: "0",
    },
  ],
  [
    "path",
    {
      d: "M4 12h16",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeWidth: "1.5",
      key: "1",
    },
  ],
  [
    "path",
    {
      d: "M4 17h10",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeWidth: "1.5",
      key: "2",
    },
  ],
];

export function ListIcon(props: IconProps) {
  return <Glyph icon={ListRows} {...props} />;
}

export function LiveAppsIcon(props: IconProps) {
  return (
    <OfficeSvg kind="apps" {...props}>
      <path
        className="sq sq-tl"
        strokeLinecap="square"
        d="M3.1903 8.95671C3 8.49728 3 7.91485 3 6.75C3 5.58515 3 5.00272 3.1903 4.54329C3.44404 3.93072 3.93072 3.44404 4.54329 3.1903C5.00272 3 5.58515 3 6.75 3C7.91485 3 8.49728 3 8.95671 3.1903C9.56928 3.44404 10.056 3.93072 10.3097 4.54329C10.5 5.00272 10.5 5.58515 10.5 6.75C10.5 7.91485 10.5 8.49728 10.3097 8.95671C10.056 9.56928 9.56928 10.056 8.95671 10.3097C8.49728 10.5 7.91485 10.5 6.75 10.5C5.58515 10.5 5.00272 10.5 4.54329 10.3097C3.93072 10.056 3.44404 9.56928 3.1903 8.95671Z"
      />
      <path
        className="sq sq-tr"
        strokeLinecap="square"
        d="M13.6903 8.95671C13.5 8.49728 13.5 7.91485 13.5 6.75C13.5 5.58515 13.5 5.00272 13.6903 4.54329C13.944 3.93072 14.4307 3.44404 15.0433 3.1903C15.5027 3 16.0851 3 17.25 3C18.4149 3 18.9973 3 19.4567 3.1903C20.0693 3.44404 20.556 3.93072 20.8097 4.54329C21 5.00272 21 5.58515 21 6.75C21 7.91485 21 8.49728 20.8097 8.95671C20.556 9.56928 20.0693 10.056 19.4567 10.3097C18.9973 10.5 18.4149 10.5 17.25 10.5C16.0851 10.5 15.5027 10.5 15.0433 10.3097C14.4307 10.056 13.944 9.56928 13.6903 8.95671Z"
      />
      <path
        className="sq sq-bl"
        strokeLinecap="square"
        d="M3.1903 19.4567C3 18.9973 3 18.4149 3 17.25C3 16.0851 3 15.5027 3.1903 15.0433C3.44404 14.4307 3.93072 13.944 4.54329 13.6903C5.00272 13.5 5.58515 13.5 6.75 13.5C7.91485 13.5 8.49728 13.5 8.95671 13.6903C9.56928 13.944 10.056 14.4307 10.3097 15.0433C10.5 15.5027 10.5 16.0851 10.5 17.25C10.5 18.4149 10.5 18.9973 10.3097 19.4567C10.056 20.0693 9.56928 20.556 8.95671 20.8097C8.49728 21 7.91485 21 6.75 21C5.58515 21 5.00272 21 4.54329 20.8097C3.93072 20.556 3.44404 20.0693 3.1903 19.4567Z"
      />
      <path
        className="sq sq-br"
        strokeLinecap="square"
        d="M13.6903 19.4567C13.5 18.9973 13.5 18.4149 13.5 17.25C13.5 16.0851 13.5 15.5027 13.6903 15.0433C13.944 14.4307 14.4307 13.944 15.0433 13.6903C15.5027 13.5 16.0851 13.5 17.25 13.5C18.4149 13.5 18.9973 13.5 19.4567 13.6903C20.0693 13.944 20.556 14.4307 20.8097 15.0433C21 15.5027 21 16.0851 21 17.25C21 18.4149 21 18.9973 20.8097 19.4567C20.556 20.0693 20.0693 20.556 19.4567 20.8097C18.9973 21 18.4149 21 17.25 21C16.0851 21 15.5027 21 15.0433 20.8097C14.4307 20.556 13.944 20.0693 13.6903 19.4567Z"
      />
    </OfficeSvg>
  );
}

export function RoomIcon(props: IconProps) {
  return <Glyph icon={UserGroupIcon} {...props} />;
}

export function GraphIcon(props: IconProps) {
  return <Glyph icon={HierarchyIcon} {...props} />;
}

export function MicIcon(props: IconProps) {
  return <Glyph icon={Mic01Icon} {...props} />;
}

export function MonitorIcon(props: IconProps) {
  return <Glyph icon={ComputerIcon} {...props} />;
}

export function CloseIcon(props: IconProps) {
  return <Glyph icon={Cancel01Icon} {...props} />;
}

export function ChevronLeftIcon(props: IconProps) {
  return <Glyph icon={ChevronLeftGlyph} {...props} />;
}

export function ChevronRightIcon(props: IconProps) {
  return <Glyph icon={ChevronRightGlyph} {...props} />;
}

export function ChevronDownIcon(props: IconProps) {
  return <Glyph icon={ChevronDownGlyph} {...props} />;
}

export function CaretSwapIcon(props: IconProps) {
  return (
    <OfficeSvg kind="caret" {...props}>
      <g className="caret-up">
        <path d="M7 4V20" />
        <path d="M10 6.99998C10 6.99998 7.79053 4.00001 6.99998 4C6.20942 3.99999 4 7 4 7" />
      </g>
      <g className="caret-down">
        <path d="M17 19L17 4" />
        <path d="M20 17C20 17 17.7905 20 17 20C16.2094 20 14 17 14 17" />
      </g>
    </OfficeSvg>
  );
}

export function CollapseIcon(props: IconProps) {
  return <Glyph icon={ArrowLeftToLineIcon} {...props} />;
}

export function FileIcon(props: IconProps) {
  return <Glyph icon={File01Icon} {...props} />;
}

export function ImageFileIcon(props: IconProps) {
  return <Glyph icon={Image01Icon} {...props} />;
}

export function MarkdownFileIcon(props: IconProps) {
  return <Glyph icon={Note01Icon} {...props} />;
}

export function FolderIcon(props: IconProps) {
  return <Glyph icon={Folder01Icon} {...props} />;
}

export function FolderOpenIcon(props: IconProps) {
  return <Glyph icon={FolderOpenGlyph} {...props} />;
}

export function ImportIcon(props: IconProps) {
  return <Glyph icon={InboxDownloadIcon} {...props} />;
}

export function FileKindIcon(props: { name: string; className?: string }) {
  const kind = computerFileKind(props.name);
  if (kind === "image" || kind === "svg") {
    return <ImageFileIcon className={props.className} />;
  }
  if (kind === "md") return <MarkdownFileIcon className={props.className} />;
  return <FileIcon className={props.className} />;
}

export function MoreIcon(props: IconProps) {
  return <Glyph icon={MoreHorizontalIcon} {...props} />;
}

export function CopyIcon(props: IconProps) {
  return <Glyph icon={Copy01Icon} {...props} />;
}

export function ShareIcon(props: IconProps) {
  return <Glyph icon={Share08Icon} {...props} />;
}

export function PeoplePlusIcon(props: IconProps) {
  return (
    <OfficeSvg kind="people" {...props}>
      <g className="faces">
        <path d="M2.5 20C2.73089 17.0974 5.18124 14.6723 8.18816 14.5298C8.44209 14.5178 8.71121 14.5076 8.99999 14.5L9.80845 14.5521C11.2257 14.6435 12.51 15.1986 13.5 16.0632" />
        <path d="M12.25 8.75C12.25 10.5449 10.7949 12 9 12C7.20508 12 5.75 10.5449 5.75 8.75C5.75 6.95507 7.20508 5.5 9 5.5C10.7949 5.5 12.25 6.95507 12.25 8.75Z" />
        <path d="M15 10.9961C16.3442 11.1229 17.5564 11.6799 18.5 12.5197" />
        <path d="M15.4877 8C16.3965 7.42434 17.0001 6.40788 17.0001 5.25C17.0001 3.45507 15.5496 2 13.7602 2C12.8811 2 12.0838 2.35121 11.5001 2.92139" />
      </g>
      <g className="badge">
        <path d="M18.5 16V22M21.5 19L15.5 19" />
      </g>
    </OfficeSvg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <OfficeSvg kind="help" {...props}>
      <circle className="rim" cx="12" cy="12" r="10" />
      <path
        className="mark"
        d="M9.5 9.5C9.5 8.11929 10.6193 7 12 7C13.3807 7 14.5 8.11929 14.5 9.5C14.5 10.3569 14.0689 11.1131 13.4117 11.5636C12.7283 12.0319 12 12.6716 12 13.5"
      />
      <path
        className="dot"
        d="M12.125 16.75H12M12.25 16.75C12.25 16.8881 12.1381 17 12 17C11.8619 17 11.75 16.8881 11.75 16.75C11.75 16.6119 11.8619 16.5 12 16.5C12.1381 16.5 12.25 16.6119 12.25 16.75Z"
      />
    </OfficeSvg>
  );
}

export function DownloadIcon(props: IconProps) {
  return <Glyph icon={Download01Icon} {...props} />;
}

export function UploadIcon(props: IconProps) {
  return <Glyph icon={Upload01Icon} {...props} />;
}

export function PinIcon(props: IconProps & { weight?: "regular" | "fill" }) {
  const { weight, ...rest } = props;
  return (
    <Glyph
      icon={PinGlyph}
      strokeWidth={weight === "fill" ? 2 : 1.5}
      {...rest}
    />
  );
}

export function TrashIcon(props: IconProps) {
  return <Glyph icon={Delete02Icon} {...props} />;
}

export function FilterIcon(props: IconProps) {
  return <Glyph icon={FilterGlyph} {...props} />;
}

export function GearIcon(props: IconProps) {
  return (
    <OfficeSvg kind="gear" {...props}>
      <g className="ring">
        <path d="M21.3175 7.14139L20.8239 6.28479C20.4506 5.63696 20.264 5.31305 19.9464 5.18388C19.6288 5.05472 19.2696 5.15664 18.5513 5.36048L17.3311 5.70418C16.8725 5.80994 16.3913 5.74994 15.9726 5.53479L15.6357 5.34042C15.2766 5.11043 15.0004 4.77133 14.8475 4.37274L14.5136 3.37536C14.294 2.71534 14.1842 2.38533 13.9228 2.19657C13.6615 2.00781 13.3143 2.00781 12.6199 2.00781H11.5051C10.8108 2.00781 10.4636 2.00781 10.2022 2.19657C9.94085 2.38533 9.83106 2.71534 9.61149 3.37536L9.27753 4.37274C9.12465 4.77133 8.84845 5.11043 8.48937 5.34042L8.15249 5.53479C7.73374 5.74994 7.25259 5.80994 6.79398 5.70418L5.57375 5.36048C4.85541 5.15664 4.49625 5.05472 4.17867 5.18388C3.86109 5.31305 3.67445 5.63696 3.30115 6.28479L2.80757 7.14139C2.45766 7.74864 2.2827 8.05227 2.31666 8.37549C2.35061 8.69871 2.58483 8.95918 3.05326 9.48012L4.0843 10.6328C4.3363 10.9518 4.51521 11.5078 4.51521 12.0077C4.51521 12.5078 4.33636 13.0636 4.08433 13.3827L3.05326 14.5354C2.58483 15.0564 2.35062 15.3168 2.31666 15.6401C2.2827 15.9633 2.45766 16.2669 2.80757 16.8741L3.30114 17.7307C3.67443 18.3785 3.86109 18.7025 4.17867 18.8316C4.49625 18.9608 4.85542 18.8589 5.57377 18.655L6.79394 18.3113C7.25263 18.2055 7.73387 18.2656 8.15267 18.4808L8.4895 18.6752C8.84851 18.9052 9.12464 19.2442 9.2775 19.6428L9.61149 20.6403C9.83106 21.3003 9.94085 21.6303 10.2022 21.8191C10.4636 22.0078 10.8108 22.0078 11.5051 22.0078H12.6199C13.3143 22.0078 13.6615 22.0078 13.9228 21.8191C14.1842 21.6303 14.294 21.3003 14.5136 20.6403L14.8476 19.6428C15.0004 19.2442 15.2765 18.9052 15.6356 18.6752L15.9724 18.4808C16.3912 18.2656 16.8724 18.2055 17.3311 18.3113L18.5513 18.655C19.2696 18.8589 19.6288 18.9608 19.9464 18.8316C20.264 18.7025 20.4506 18.3785 20.8239 17.7307L21.3175 16.8741C21.6674 16.2669 21.8423 15.9633 21.8084 15.6401C21.7744 15.3168 21.5402 15.0564 21.0718 14.5354L20.0407 13.3827C19.7887 13.0636 19.6098 12.5078 19.6098 12.0077C19.6098 11.5078 19.7888 10.9518 20.0407 10.6328L21.0718 9.48012C21.5402 8.95918 21.7744 8.69871 21.8084 8.37549C21.8423 8.05227 21.6674 7.74864 21.3175 7.14139Z" />
      </g>
      <circle className="hub" cx="12.0195" cy="12" r="3.5" />
    </OfficeSvg>
  );
}

export function DoubleChevronIcon(props: IconProps) {
  return <Glyph icon={ArrowRightDoubleIcon} {...props} />;
}

export function CheckIcon(props: IconProps) {
  return <Glyph icon={Tick01Icon} {...props} />;
}

export function SignOutIcon(props: IconProps) {
  return <Glyph icon={Logout01Icon} {...props} />;
}

export function GitHubIcon(props: IconProps) {
  return <Glyph icon={GithubIcon} {...props} />;
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <OfficeSvg kind="send" {...props}>
      <path
        className="chev"
        d="M17.9998 15C17.9998 15 13.5809 9.00001 11.9998 9C10.4187 8.99999 5.99985 15 5.99985 15"
      />
    </OfficeSvg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return <Glyph icon={ArrowDown01Icon} {...props} />;
}

export function ReloadIcon(props: IconProps) {
  return <Glyph icon={ArrowReloadHorizontalIcon} {...props} />;
}

export function PencilIcon(props: IconProps) {
  return <Glyph icon={PencilEdit01Icon} {...props} />;
}

export function SquareIcon(props: IconProps) {
  return <Glyph icon={SquareGlyph} {...props} />;
}

export function WarningCircleIcon(props: IconProps) {
  return <Glyph icon={AlertCircleIcon} {...props} />;
}

export function XCircleIcon(props: IconProps) {
  return <Glyph icon={CancelCircleIcon} {...props} />;
}

export function SpinnerIcon(props: IconProps) {
  return <Glyph icon={Loading03Icon} {...props} />;
}

export function ImageBrokenIcon(props: IconProps) {
  return <Glyph icon={ImageNotFoundIcon} {...props} />;
}

export function ShieldWarningIcon(props: IconProps) {
  return <Glyph icon={ShieldAlertIcon} {...props} />;
}

export function FileTextIcon(props: IconProps) {
  return <Glyph icon={Note01Icon} {...props} />;
}

export function FileAudioIcon(props: IconProps) {
  return <Glyph icon={FileAudioGlyph} {...props} />;
}

export function FileVideoIcon(props: IconProps) {
  return <Glyph icon={Video01Icon} {...props} />;
}

export function CodeFileIcon(props: IconProps) {
  return <Glyph icon={SourceCodeIcon} {...props} />;
}

export function GoogleIcon(props: IconProps) {
  return (
    <svg
      className={props.className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <title>Google</title>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.48a5.54 5.54 0 01-2.4 3.64v3.02h3.88c2.27-2.09 3.53-5.17 3.53-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0012 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.26a7.2 7.2 0 010-4.52V6.63H1.27a12 12 0 000 10.74l4-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.36.61 4.61 1.8l3.46-3.46C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.63l4 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
