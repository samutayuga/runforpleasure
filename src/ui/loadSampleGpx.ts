import { Asset } from "expo-asset";

// Returns the bundled Morning_Run.gpx file contents as a string.
export async function loadSampleGpx(): Promise<string> {
  const asset = Asset.fromModule(require("../../assets/Morning_Run.gpx"));
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const res = await fetch(uri);
  return res.text();
}
