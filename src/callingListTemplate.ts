import { Platform } from "react-native";
import { EXCEL_TYPE } from "./calling-lists";

export async function saveExcelFile(template: { fileName: string; base64: string }, dialogTitle = "Save Excel file") {
  const bytes = Uint8Array.from(atob(template.base64), character => character.charCodeAt(0));
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([bytes], { type: EXCEL_TYPE }));
    const link = document.createElement("a");
    link.href = url; link.download = template.fileName;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const sharing = await import("expo-sharing");
  if (!await sharing.isAvailableAsync()) throw new Error("File saving is unavailable on this device. Download the Excel file from the web app.");
  const { File, Paths } = await import("expo-file-system");
  const file = new File(Paths.cache, `${Date.now()}-${template.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
  try {
    await file.write(bytes);
    await sharing.shareAsync(file.uri, { mimeType: EXCEL_TYPE, UTI: "org.openxmlformats.spreadsheetml.sheet", dialogTitle });
  } finally {
    if (file.exists) file.delete();
  }
}

export async function saveCallingListTemplate(template: { fileName: string; base64: string }) {
  return saveExcelFile(template, "Save blank CP Excel template");
}
