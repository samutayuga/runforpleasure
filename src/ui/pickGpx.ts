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
  // Use a wide-open type so the OS file dialog never greys out .gpx files —
  // .gpx has no reliably-registered MIME type, so a specific accept list can
  // leave the file disabled. We validate by parsing instead of by MIME.
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
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

/**
 * Open a document picker allowing multiple .gpx files to be selected.
 * Returns an array of { name, xml } for each picked file, or [] if cancelled.
 */
export async function pickMultipleGpx(): Promise<PickedGpx[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", multiple: true, copyToCacheDirectory: true });
  if (result.canceled || !result.assets || result.assets.length === 0) return [];
  const out: PickedGpx[] = [];
  for (const asset of result.assets) {
    let xml: string;
    if (Platform.OS === "web") { const res = await fetch(asset.uri); xml = await res.text(); }
    else { xml = await FileSystem.readAsStringAsync(asset.uri); }
    out.push({ name: asset.name ?? "Imported run", xml });
  }
  return out;
}
