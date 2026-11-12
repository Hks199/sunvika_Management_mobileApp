import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Clock3, Download, ExternalLink, Share2, X } from "lucide-react-native";
import { api } from "../api";
import { useAuth } from "../auth";
import { downloadQuotationPdf, quotationFileName, shareQuotationPdf, type QuotationPdf } from "../quotationPdf";
import type { RecordValue } from "../types";
import { ActionButton, Card, ErrorNotice, Field, LoadingState } from "../ui";

function isRecord(value: unknown): value is RecordValue { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
const hiddenField = /password|token|secret|s3key|uploadId|^key$|^__v$|^_id$|^id$|^version$|^totalProjectAmount$/i;
function label(value: string) { return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }
function display(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") {
    if (/^[a-f\d]{24}$/i.test(value)) return "Linked record";
    if (/^\d{4}-\d\d-\d\d/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(display).join(", ") || "—";
  if (isRecord(value)) {
    if (value.$numberDecimal !== undefined) return String(value.$numberDecimal);
    const person = [value.firstName, value.lastName].filter((part) => typeof part === "string" && part).join(" ");
    if (person) return [person, value.employeeCode].filter(Boolean).join(" · ");
    for (const key of ["name", "customerName", "leadCode", "employeeCode", "quotationNumber", "code"]) if (typeof value[key] === "string" && value[key]) return value[key];
    return Object.entries(value).filter(([key]) => !hiddenField.test(key)).map(([key, part]) => `${label(key)}: ${display(part)}`).join(", ") || "—";
  }
  return "—";
}

type ShareResult = { whatsappUrl: string; expiresAt?: string; deliveryStatus?: string };
function httpUrl(value: unknown) {
  if (typeof value !== "string" || !value) throw new Error("The API did not return a valid link.");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("The link must use HTTP or HTTPS.");
  return url.toString();
}

export default function QuotationDetailsModal({ quotationId, onClose, onSaved }: {
  quotationId: string; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const roleCode = typeof user?.role === "string" ? user.role : user?.role?.code;
  const canSendQuotation = Boolean(roleCode) && roleCode !== "CP";
  const [record, setRecord] = useState<RecordValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharingForm, setSharingForm] = useState(false);
  const [mobileNumber, setMobileNumber] = useState("");
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [pdf, setPdf] = useState<QuotationPdf | null>(null);
  const [download, setDownload] = useState<{ url: string; expiresInSeconds?: number } | null>(null);
  const [history, setHistory] = useState<RecordValue[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const requestId = useRef(0);
  const path = `/quotations/${encodeURIComponent(quotationId)}`;

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.get<unknown>(path);
      if (current !== requestId.current) return;
      if (!isRecord(response.data)) throw new Error("No quotation details are available for this record.");
      setRecord(response.data);
    } catch (cause) {
      if (current === requestId.current) setError(cause instanceof Error ? cause.message : "Unable to load quotation details.");
    } finally { if (current === requestId.current) setLoading(false); }
  }, [path]);
  useEffect(() => { void load(); return () => { requestId.current += 1; }; }, [load]);

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await api.get<unknown>(`${path}/shares`);
      const value = response.data;
      const rows = Array.isArray(value) ? value : isRecord(value) ? value.items ?? value.data ?? value.shares : null;
      if (!Array.isArray(rows)) throw new Error("The API returned invalid share history.");
      setHistory(rows.filter(isRecord));
    } catch (cause) { setHistoryError(cause instanceof Error ? cause.message : "Unable to load share history."); }
    finally { setHistoryLoading(false); }
  }

  async function fetchPdf() {
    const bytes = await api.getPdf(`${path}/file`);
    const prepared = { bytes, fileName: quotationFileName(record?.quotationNumber) };
    setPdf(prepared);
    return prepared;
  }

  async function prepareShare() {
    if (!canSendQuotation) return;
    const number = mobileNumber.trim();
    setActionError("");
    if (!/^\+?[0-9]{10,15}$/.test(number)) { setActionError("Enter a valid WhatsApp number (10–15 digits, with optional +)."); return; }
    setBusy(true);
    setShareResult(null);
    setPdf(null);
    try {
      const response = await api.post<ShareResult>(`${path}/share`, { mobileNumber: number });
      const result = response.data;
      const whatsappUrl = httpUrl(result?.whatsappUrl);
      if (!["wa.me", "api.whatsapp.com", "web.whatsapp.com", "www.whatsapp.com"].includes(new URL(whatsappUrl).hostname)) throw new Error("The API did not return a valid WhatsApp chat link.");
      setShareResult({ ...result, whatsappUrl });
      setSharingForm(false);
      onSaved();
      if (history !== null) void loadHistory();
      await fetchPdf();
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to prepare quotation sharing."); }
    finally { setBusy(false); }
  }

  async function retryPdf() {
    setBusy(true); setActionError("");
    try { await fetchPdf(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to load quotation PDF."); }
    finally { setBusy(false); }
  }

  async function getDownload() {
    setBusy(true); setActionError(""); setDownload(null);
    try {
      const response = await api.get<{ url?: string; expiresInSeconds?: number }>(`${path}/download-url`);
      setDownload({ url: httpUrl(response.data?.url), expiresInSeconds: response.data?.expiresInSeconds });
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to get quotation download link."); }
    finally { setBusy(false); }
  }

  async function fileAction(action: "share" | "download") {
    if (!pdf || (action === "share" && !canSendQuotation)) return;
    setActionError(""); setBusy(true);
    try { if (action === "share") await shareQuotationPdf(pdf); else await downloadQuotationPdf(pdf); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to open the device share menu."); }
    finally { setBusy(false); }
  }

  async function openUrl(url: string) {
    setActionError("");
    try { await Linking.openURL(httpUrl(url)); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to open link."); }
  }

  return <Modal transparent animationType="slide" visible onRequestClose={() => { if (!busy) onClose(); }}>
    <View className="flex-1 justify-end bg-black/40"><View className="max-h-[92%] rounded-t-3xl bg-brand-canvas px-5 pb-8 pt-5">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <View className="flex-1"><Text className="text-[10px] font-bold tracking-wide text-brand-navy">QUOTATION DETAILS</Text><Text numberOfLines={2} className="mt-1 text-xl font-bold text-brand-ink">{record ? display(record.quotationNumber) : "Loading quotation…"}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close quotation details" disabled={busy} onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white"><X size={19} color="#17204f" /></Pressable>
      </View>
      <ScrollView className="max-h-[84%]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loading ? <LoadingState label="Loading quotation details…" /> : null}
        {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}
        {record && !loading ? <>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {canSendQuotation ? <ActionButton label={sharingForm ? "Cancel sharing" : "Share quotation via WhatsApp"} icon={Share2} disabled={busy} onPress={() => { setSharingForm((current) => !current); setActionError(""); }} /> : null}
            <ActionButton label="Download PDF" icon={Download} kind="secondary" disabled={busy} onPress={() => void getDownload()} />
            <ActionButton label="Share history" icon={Clock3} kind="secondary" disabled={historyLoading} onPress={() => void loadHistory()} />
          </View>
          {actionError ? <ErrorNotice message={actionError} /> : null}
          {download ? <Card className="mb-4"><Text className="mb-3 text-sm text-brand-ink">Your quotation download is ready.{typeof download.expiresInSeconds === "number" ? ` Link expires in ${download.expiresInSeconds} seconds.` : ""}</Text><ActionButton label="Open download" icon={ExternalLink} onPress={() => void openUrl(download.url)} /></Card> : null}
          {canSendQuotation && sharingForm ? <Card className="mb-4">
            <Text className="mb-3 text-base font-bold text-brand-ink">Share quotation via WhatsApp</Text>
            <Text className="mb-4 text-xs leading-5 text-brand-muted">The device share menu asks you to choose WhatsApp and the recipient. This number is only for the chat-link fallback; WhatsApp cannot pre-attach a PDF to a selected chat.</Text>
            <Field label="WhatsApp number for chat-link fallback" accessibilityLabel="WhatsApp number for chat-link fallback" keyboardType="phone-pad" autoCapitalize="none" maxLength={16} value={mobileNumber} editable={!busy} onChangeText={setMobileNumber} placeholder="Country code and mobile number" />
            <ActionButton label={busy ? "Preparing…" : "Prepare PDF & WhatsApp link"} disabled={busy} onPress={() => void prepareShare()} />
          </Card> : null}
          {canSendQuotation && shareResult ? <Card className="mb-4">
            <Text className="mb-2 text-base font-bold text-brand-ink">Quotation sharing</Text>
            <Text className="mb-2 text-xs leading-5 text-brand-muted">Link created; delivery not confirmed.{shareResult.expiresAt ? ` Expires ${display(shareResult.expiresAt)}.` : ""}</Text>
            <View className="flex-row flex-wrap gap-2">
              {pdf ? <><ActionButton label="Share PDF" icon={Share2} disabled={busy} onPress={() => void fileAction("share")} /><ActionButton label="Download prepared PDF" icon={Download} kind="secondary" disabled={busy} onPress={() => void fileAction("download")} /></> : <ActionButton label={busy ? "Loading PDF…" : "Retry PDF"} kind="secondary" disabled={busy} onPress={() => void retryPdf()} />}
              <ActionButton label="Open WhatsApp chat" icon={ExternalLink} kind="secondary" disabled={busy} onPress={() => void openUrl(shareResult.whatsappUrl)} />
            </View>
            <Text className="mt-3 text-xs leading-5 text-brand-muted">Choose WhatsApp from the device share menu, then select the recipient. WhatsApp does not allow a PDF to be attached to a preselected chat.</Text>
          </Card> : null}
          <Card className="mb-4"><Text className="mb-1 text-base font-bold text-brand-ink">Quotation information</Text>
            {Object.entries(record).filter(([key]) => !hiddenField.test(key)).map(([key, value]) => <View key={key} className="border-b border-brand-line py-3"><Text className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">{label(key)}</Text><Text className="mt-1 text-sm leading-5 text-brand-ink">{display(value)}</Text></View>)}
          </Card>
          {historyLoading || historyError || history !== null ? <Card className="mb-4">
            <Text className="mb-2 text-base font-bold text-brand-ink">Share history</Text>
            {historyError ? <ErrorNotice message={historyError} onRetry={() => void loadHistory()} /> : null}
            {historyLoading ? <LoadingState label="Loading share history…" /> : history?.length ? history.map((share, index) => <View key={String(share._id ?? index)} className="border-b border-brand-line py-3">
              <Text className="text-sm font-bold text-brand-ink">{typeof share.channel === "string" ? share.channel.replace(/_/g, " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "WhatsApp"}</Text>
              <Text className="mt-1 text-xs leading-5 text-brand-muted">{share.linkCreatedAt ? display(share.linkCreatedAt) : "Time unavailable"}{isRecord(share.sharedBy) ? ` · Shared by ${display(share.sharedBy)}` : ""}</Text>
              <Text className="mt-1 text-xs leading-5 text-brand-muted">{typeof share.recipientMobileLast4 === "string" && share.recipientMobileLast4 ? `Recipient: •••• ${share.recipientMobileLast4}` : "Recipient unavailable"} · Link created; delivery not confirmed</Text>
            </View>) : !historyError ? <Text className="text-sm text-brand-muted">No share history is available for this quotation yet.</Text> : null}
          </Card> : null}
        </> : null}
      </ScrollView>
    </View></View>
  </Modal>;
}
