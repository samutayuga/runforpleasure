import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

export interface PickedGpx {
  name: string;
  xml: string;
}

/**
 * Open a document picker and return the picked file's name + raw XML text,
 * or null if the user cancelled.
 */
export async function pickGpx(): Promise<PickedGpx | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/gpx+xml", "application/xml", "text/xml", "*/*"],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];

  let xml: string;
  if (Platform.OS === "web") {
    const res = await fetch(asset.uri);
    xml = await res.text();
  } else {
    xml = await FileSystem.readAsStringAsync(asset.uri);
  }

  return { name: asset.name ?? "Imported run", xml };
}
