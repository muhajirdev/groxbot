import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import {
  assertAttachable,
  base64ToBytes,
  OfficeBlobFile,
} from "./computer-attachment";

async function fileFromUri(input: {
  uri: string;
  name: string;
  type: string;
  size?: number;
  pending: number;
}): Promise<OfficeBlobFile> {
  const base64 = await FileSystem.readAsStringAsync(input.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToBytes(base64);
  assertAttachable({
    name: input.name,
    size: input.size ?? bytes.byteLength,
    pending: input.pending,
  });
  return new OfficeBlobFile({
    name: input.name || "attachment",
    type: input.type || "application/octet-stream",
    bytes,
    previewUri: input.type.startsWith("image/") ? input.uri : undefined,
  });
}

export async function pickOfficeFiles(
  pending: number,
): Promise<OfficeBlobFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
    type: "*/*",
  });
  if (result.canceled) return [];
  const files: OfficeBlobFile[] = [];
  for (const asset of result.assets) {
    files.push(
      await fileFromUri({
        uri: asset.uri,
        name: asset.name || "attachment",
        type: asset.mimeType || "application/octet-stream",
        size: asset.size,
        pending: pending + files.length,
      }),
    );
  }
  return files;
}

export async function pickOfficePhotos(
  pending: number,
): Promise<OfficeBlobFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error("Photo library permission is required.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 0.8,
    base64: true,
  });
  if (result.canceled) return [];
  const files: OfficeBlobFile[] = [];
  for (const asset of result.assets) {
    const bytes = asset.base64 ? base64ToBytes(asset.base64) : undefined;
    if (bytes) {
      assertAttachable({
        name: asset.fileName || "photo.jpg",
        size: bytes.byteLength,
        pending: pending + files.length,
      });
      files.push(
        new OfficeBlobFile({
          name: asset.fileName || "photo.jpg",
          type: asset.mimeType || "image/jpeg",
          bytes,
          previewUri: asset.uri,
        }),
      );
      continue;
    }
    if (!asset.uri) continue;
    files.push(
      await fileFromUri({
        uri: asset.uri,
        name: asset.fileName || "photo.jpg",
        type: asset.mimeType || "image/jpeg",
        pending: pending + files.length,
      }),
    );
  }
  return files;
}
