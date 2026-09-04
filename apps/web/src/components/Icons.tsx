import {
  CaretDoubleRightIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretLineLeftIcon,
  CaretUpDownIcon,
  CheckIcon as PhosphorCheck,
  CopySimpleIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
  FileIcon as PhosphorFile,
  FileMdIcon,
  FunnelIcon,
  GearIcon as PhosphorGear,
  GithubLogoIcon,
  GraphIcon as PhosphorGraph,
  ImageIcon as PhosphorImage,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  MonitorIcon as PhosphorMonitor,
  LightningIcon as PhosphorLightning,
  PlugIcon as PhosphorPlug,
  PlusIcon as PhosphorPlus,
  BooksIcon as PhosphorBooks,
  SquaresFourIcon as PhosphorSquaresFour,
  PushPinIcon,
  SignOutIcon as PhosphorSignOut,
  TrashSimpleIcon,
  UsersThreeIcon,
  XIcon as PhosphorX,
} from "@phosphor-icons/react";

type IconProps = { className?: string };

export function SearchIcon(props: IconProps) {
  return <MagnifyingGlassIcon className={props.className} />;
}

export function PlusIcon(props: IconProps) {
  return <PhosphorPlus className={props.className} />;
}

export function PlugIcon(props: IconProps) {
  return <PhosphorPlug className={props.className} />;
}

export function KnowledgeIcon(props: IconProps) {
  return <PhosphorBooks className={props.className} />;
}

export function SkillsIcon(props: IconProps) {
  return <PhosphorLightning className={props.className} />;
}

export function LiveAppsIcon(props: IconProps) {
  return <PhosphorSquaresFour className={props.className} />;
}

export function RoomIcon(props: IconProps) {
  return <UsersThreeIcon className={props.className} />;
}

export function GraphIcon(props: IconProps) {
  return <PhosphorGraph className={props.className} />;
}

export function MicIcon(props: IconProps) {
  return <MicrophoneIcon className={props.className} />;
}

export function MonitorIcon(props: IconProps) {
  return <PhosphorMonitor className={props.className} />;
}

export function CloseIcon(props: IconProps) {
  return <PhosphorX className={props.className} />;
}

export function ChevronLeftIcon(props: IconProps) {
  return <CaretLeftIcon className={props.className} />;
}

export function ChevronDownIcon(props: IconProps) {
  return <CaretDownIcon className={props.className} />;
}

export function CaretSwapIcon(props: IconProps) {
  return <CaretUpDownIcon className={props.className} />;
}

export function CollapseIcon(props: IconProps) {
  return <CaretLineLeftIcon className={props.className} />;
}

export function FileIcon(props: IconProps) {
  return <PhosphorFile className={props.className} />;
}

export function ImageFileIcon(props: IconProps) {
  return <PhosphorImage className={props.className} />;
}

export function MarkdownFileIcon(props: IconProps) {
  return <FileMdIcon className={props.className} />;
}

export function MoreIcon(props: IconProps) {
  return <DotsThreeIcon className={props.className} />;
}

export function CopyIcon(props: IconProps) {
  return <CopySimpleIcon className={props.className} />;
}

export function DownloadIcon(props: IconProps) {
  return <DownloadSimpleIcon className={props.className} />;
}

export function UploadIcon(props: IconProps) {
  return <UploadSimpleIcon className={props.className} />;
}

export function PinIcon(props: IconProps & { weight?: "regular" | "fill" }) {
  return <PushPinIcon className={props.className} weight={props.weight} />;
}

export function TrashIcon(props: IconProps) {
  return <TrashSimpleIcon className={props.className} />;
}

export function FilterIcon(props: IconProps) {
  return <FunnelIcon className={props.className} />;
}

export function GearIcon(props: IconProps) {
  return <PhosphorGear className={props.className} />;
}

export function DoubleChevronIcon(props: IconProps) {
  return <CaretDoubleRightIcon className={props.className} />;
}

export function CheckIcon(props: IconProps) {
  return <PhosphorCheck className={props.className} />;
}

export function SignOutIcon(props: IconProps) {
  return <PhosphorSignOut className={props.className} />;
}

export function GitHubIcon(props: IconProps) {
  return <GithubLogoIcon className={props.className} />;
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
