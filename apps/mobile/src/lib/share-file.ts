import type { ComputerDownload } from "@groxbot/contracts";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { computerDownloadFilename } from "./computer-download";

export async function shareComputerDownload(
  file: ComputerDownload,
): Promise<void> {
  const filename = file.filename || computerDownloadFilename(file.path);
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error("No cache directory to share from.");
  const uri = `${dir}${filename}`;
  const payload = file.content.replace(/^data:[^;]*;base64,/iu, "");
  await FileSystem.writeAsStringAsync(uri, payload, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: file.mediaType || "application/octet-stream",
    dialogTitle: filename,
  });
}
