import { Platform } from "react-native";

export type QuotationPdf = { bytes: ArrayBuffer; fileName: string };

export function quotationFileName(number: unknown) {
  return `${String(number ?? "quotation").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "quotation"}.pdf`;
}

async function nativeShare(pdf: QuotationPdf, dialogTitle: string) {
  const sharing = await import("expo-sharing");
  if (!await sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device. Use the quotation download link instead.");
  const { File, Paths } = await import("expo-file-system");
  const file = new File(Paths.cache, `${Date.now()}-${pdf.fileName}`);
  try {
    await file.write(pdf.bytes);
    await sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle });
  } finally {
    if (file.exists) file.delete();
  }
}

export async function shareQuotationPdf(pdf: QuotationPdf) {
  if (Platform.OS !== "web") return nativeShare(pdf, "Share quotation PDF");
  const file = new File([pdf.bytes], pdf.fileName, { type: "application/pdf" });
  if (typeof navigator.share !== "function" || !navigator.canShare?.({ files: [file] })) throw new Error("This browser cannot share PDF files directly. Download the quotation, then attach it in WhatsApp.");
  try { await navigator.share({ files: [file], title: file.name, text: `Sunvika Private Limited quotation ${file.name}` }); }
  catch (cause) { if (!(cause instanceof Error && cause.name === "AbortError")) throw cause; }
}

export async function downloadQuotationPdf(pdf: QuotationPdf) {
  if (Platform.OS !== "web") return nativeShare(pdf, "Save quotation PDF");
  const url = URL.createObjectURL(new Blob([pdf.bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = pdf.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
