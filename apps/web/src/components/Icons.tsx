import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeftToLineIcon,
  ArrowReloadHorizontalIcon,
  ArrowRightDoubleIcon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  Bookmark01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  ChevronDownIcon as ChevronDownGlyph,
  ChevronLeftIcon as ChevronLeftGlyph,
  ChevronRightIcon as ChevronRightGlyph,
  ComputerIcon,
  Copy01Icon,
  DashboardSquare01Icon,
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
  KnowledgeIcon as KnowledgeGlyph,
  Loading03Icon,
  Logout01Icon,
  Mic01Icon,
  MoreHorizontalIcon,
  Note01Icon,
  PencilEdit01Icon,
  PinIcon as PinGlyph,
  Plug01Icon,
  PlusSignIcon,
  SearchIcon as SearchGlyph,
  Settings01Icon,
  ShieldAlertIcon,
  SourceCodeIcon,
  SquareIcon as SquareGlyph,
  Tick01Icon,
  Upload01Icon,
  UserGroupIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { SVGProps } from "react";
import { computerFileKind } from "../lib/computer-preview";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & {
  size?: number | string;
  strokeWidth?: number;
};

function Glyph(
  props: IconProps & {
    icon: IconSvgElement;
    altIcon?: IconSvgElement;
    showAlt?: boolean;
  },
) {
  const { icon, altIcon, showAlt, size = 18, strokeWidth = 1.5, ...rest } =
    props;
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

export function SearchIcon(props: IconProps) {
  return <Glyph icon={SearchGlyph} {...props} />;
}

export function PlusIcon(props: IconProps) {
  return <Glyph icon={PlusSignIcon} {...props} />;
}

export function PlugIcon(props: IconProps) {
  return <Glyph icon={Plug01Icon} {...props} />;
}

export function KnowledgeIcon(props: IconProps) {
  return <Glyph icon={KnowledgeGlyph} {...props} />;
}

export function SkillsIcon(props: IconProps) {
  return <Glyph icon={Bookmark01Icon} {...props} />;
}

export function LiveAppsIcon(props: IconProps) {
  return <Glyph icon={DashboardSquare01Icon} {...props} />;
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
  return <Glyph icon={ArrowUpDownIcon} {...props} />;
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
  return <Glyph icon={Settings01Icon} {...props} />;
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
  return <Glyph icon={ArrowUp01Icon} {...props} />;
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
