import EmployeeDirectoryTable from "../components/EmployeeDirectoryTable";
import { dateTimeInput, formatVisitDateTime, visitUpdatePayload } from "../visit-form";
import LeadCreateFields from "../components/LeadCreateFields";
import { createLeadPayload } from "../lead-form";
import CpBulkImport from '../components/CpBulkImport';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ChevronLeft, ChevronRight, Plus, Search, X, ArrowUpRight, Clock3 } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../api";
import { useAuth } from "../auth";
import { DateField, SelectField, type SelectOption } from "../components/VisitFields";
import CustomerDetailsModal from "./CustomerDetailsModal";
import QuotationDetailsModal from "./QuotationDetailsModal";
import EmployeeCreateModal from "./EmployeeCreateModal";
import EmployeeDetailsModal from "./EmployeeDetailsModal";
import type { ModuleKey, RecordValue } from "../types";
import { ActionButton, Card, EmptyState, ErrorNotice, Field, Heading, LoadingState, Page, RefreshAction } from "../ui";

type RecordConfig = {
  title: string;
  eyebrow: string;
  description: string;
  endpoint: string;
  columns: string[];
  searchable?: boolean;
  modes?: Array<{ value: string; label: string; endpoint?: string; days?: string }>;
  canCreate?: boolean;
};

const configs: Partial<Record<ModuleKey, RecordConfig>> = {
  leads: {
    title: "Leads", eyebrow: "CUSTOMER PIPELINE", description: "Track enquiries, follow-ups, and every opportunity in your accessible pipeline.",
    endpoint: "/leads", columns: ["leadCode", "customerName", "mobileNumber", "status", "assignedTo", "createdAt"],
    searchable: true, canCreate: true,
    modes: [
      { value: "all", label: "All leads" },
      { value: "follow-ups", label: "Upcoming follow-ups", endpoint: "/leads/follow-ups" },
      { value: "overdue", label: "Overdue follow-ups", endpoint: "/leads/follow-ups/overdue" },
    ],
  },
  visits: {
    title: "Site visits", eyebrow: "FIELD ACTIVITY", description: "Review field visits, outcomes, and customer follow-ups.",
    endpoint: "/visits", columns: ["lead", "visitedBy", "visitDate", "remark", "nextVisitDate", "createdAt"], canCreate: true,
    modes: [
      { value: "all", label: "All site visits" },
      { value: "follow-ups", label: "Upcoming follow-ups", endpoint: "/visits/follow-ups" },
      { value: "overdue", label: "Overdue follow-ups", endpoint: "/visits/follow-ups/overdue" },
    ],
  },
  customers: {
    title: "Customers", eyebrow: "RELATIONSHIP MANAGEMENT", description: "A clear view of customer profiles and ongoing relationships.",
    endpoint: "/customers", columns: ["customerCode", "customerName", "mobileNumber", "status", "createdAt"], searchable: true,
  },
  quotations: {
    title: "Quotations", eyebrow: "SALES DOCUMENTS", description: "Review generated customer quotations and manage secure sharing links.",
    endpoint: "/quotations", columns: ["quotationNumber", "lead", "status", "quotationDate"],
  },
  amc: {
    title: "AMC contracts", eyebrow: "CUSTOMER CARE", description: "Track active maintenance agreements, service schedules, and renewals.",
    endpoint: "/amc", columns: ["contractNumber", "customer", "startDate", "expiryDate", "status", "renewalStatus"], canCreate: true,
    modes: [
      { value: "all", label: "All contracts" },
      { value: "renewals", label: "Renewals", endpoint: "/amc/renewals/upcoming", days: "60" },
      { value: "schedules", label: "Service", endpoint: "/amc/schedules/upcoming", days: "60" },
    ],
  },
  "channel-partners": {
    title: "Channel Partners", eyebrow: "CHANNEL PARTNER NETWORK", description: "View and manage channel partners in your permitted hierarchy.",
    endpoint: "/employees", columns: ["employeeCode", "firstName", "lastName", "email", "mobileNumber", "reportingTo", "isActive"], canCreate: true,
    modes: [{ value: "all", label: "All channel partners" }, { value: "downline", label: "My downline", endpoint: "/employees/downline" }],
  },
  employees: {
    title: "Employees", eyebrow: "YOUR ORGANIZATION", description: "Manage accessible team members and reporting relationships.",
    endpoint: "/employees", columns: ["employeeCode", "firstName", "lastName", "email", "role", "isActive"], canCreate: true,
    modes: [
      { value: "all", label: "All employees" },
      { value: "downline", label: "My downline", endpoint: "/employees/downline" },
    ],
  },
  audit: {
    title: "Audit log", eyebrow: "SECURITY & COMPLIANCE", description: "Review recorded management actions available to your account.",
    endpoint: "/audit-logs", columns: ["action", "actor", "resource", "createdAt"],
  },
};

function unwrap(data: unknown): { rows: RecordValue[]; total: number } {
  if (Array.isArray(data)) return { rows: data.filter((item): item is RecordValue => Boolean(item) && typeof item === "object"), total: data.length };
  if (!data || typeof data !== "object") return { rows: [], total: 0 };
  const value = data as RecordValue;
  const list = value.items ?? value.results ?? value.rows ?? value.data ?? value.records ?? value.employees;
  if (!Array.isArray(list)) return { rows: [], total: 0 };
  const meta = value.meta && typeof value.meta === "object" ? value.meta as RecordValue : {};
  const total = Number(meta.total ?? value.total ?? list.length);
  return {
    rows: list.filter((item): item is RecordValue => Boolean(item) && typeof item === "object"),
    total: Number.isFinite(total) ? total : list.length,
  };
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d\d-\d\d/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return typeof value === "string" && /^[a-f\d]{24}$/i.test(value) ? "Linked record" : String(value);
  }
  if (Array.isArray(value)) return value.map(formatValue).filter((part) => part !== "—").join(", ") || "—";
  if (typeof value === "object") {
    const item = value as RecordValue;
    if (item.$numberDecimal !== undefined) return String(item.$numberDecimal);
    const person = [item.firstName, item.middleName, item.lastName].filter((part): part is string => typeof part === "string" && Boolean(part.trim())).join(" ");
    const personWithCode = [person, item.employeeCode].filter(Boolean).join(" \u00b7 ");
    const named = personWithCode || item.name || item.fullName || item.employeeName || item.customerName || item.employeeCode || item.leadCode || item.quotationNumber || item.contractNumber;
    return typeof named === "string" ? named : "Linked record";
  }
  return "—";
}

function primaryLabel(row: RecordValue): string {
  for (const key of ["customerName", "firstName", "name", "leadCode", "employeeCode", "quotationNumber", "contractNumber", "action"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      if (key === "firstName") return [value, typeof row.lastName === "string" ? row.lastName : ""].filter(Boolean).join(" ");
      return value;
    }
  }
  return "Record";
}

function geographyOptions(data: unknown): SelectOption[] {
  return unwrap(data).rows.flatMap((row) => typeof row._id === "string" && typeof row.name === "string"
    ? [{ value: row._id, label: row.name }] : []);
}

const emptyRecordFilters = { stateId: "", districtId: "", branchId: "", dateFrom: "", dateTo: "", employeeName: "", cpType: "", customerType: "" };

const leadStatuses = ["PENDING", "INTERESTED", "NOT_INTERESTED", "SITE_VISITED", "NEED_FOLLOWUP", "QUOTATION_SENT", "LOST"];
const conversionDocumentTypes = ["PAN", "AADHAAR", "ELECTRICITY_BILL", "BANK_PASSBOOK", "GEO_TAG_PHOTO"] as const;
type ConversionDocumentType = typeof conversionDocumentTypes[number];
type PickedDocument = DocumentPicker.DocumentPickerAsset;
type LeadAction = "status" | "assignment" | "edit" | "convert";
type VisitHistoryKind = "lead" | "employee";

function LeadDetailsModal({
  leadId,
  visible,
  onClose,
  onSaved,
}: {
  leadId: string;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [record, setRecord] = useState<RecordValue | null>(null);
  const [history, setHistory] = useState<RecordValue[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<LeadAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [generateQuotation, setGenerateQuotation] = useState(false);
  const [quoteRules, setQuoteRules] = useState<Array<{ stateId: string; minKW: number; maxKW: number; central: number; state: number }>>([]);
  useEffect(() => { if (visible) void api.get<{ rules: Array<{ stateId: string; minKW: number; maxKW: number; central: number; state: number }> }>('/quotations/policy').then(r => setQuoteRules(r.data.rules)).catch(() => setError('Could not load quotation policy.')); }, [visible]);
  const { user: quotationUser } = useAuth();
  const quotationRole = typeof quotationUser?.role === 'string' ? quotationUser.role : quotationUser?.role?.code;
  const [quotationOptions, setQuotationOptions] = useState<{ paymentModes: string[]; panelBrands: string[]; panelTechnologies: string[]; inverters: string[]; wattsOptions: string[]; categories: string[]; systemTypes: string[] }>({ paymentModes: [], panelBrands: [], panelTechnologies: [], inverters: [], wattsOptions: [], categories: [], systemTypes: [] });
  const [editOptions, setEditOptions] = useState(false);
  const [optionDraft, setOptionDraft] = useState({ paymentModes: '', panelBrands: '', panelTechnologies: '', inverters: '', wattsOptions: '', categories: '', systemTypes: '' });
  useEffect(() => { if (visible) void api.get<typeof quotationOptions>('/quotations/options').then(r => setQuotationOptions(r.data)).catch(() => setError('Could not load quotation options.')); }, [visible]);
  const quoteState = typeof record?.state === 'string' ? record.state : record?.state && typeof record.state === 'object' && '_id' in record.state ? String(record.state._id) : '';
  async function saveQuotationOptions() {
    try { const payload = { paymentModes: optionDraft.paymentModes.split('\n').map(x => x.trim()).filter(Boolean), panelBrands: optionDraft.panelBrands.split('\n').map(x => x.trim()).filter(Boolean), panelTechnologies: optionDraft.panelTechnologies.split('\n').map(x => x.trim()).filter(Boolean), inverters: optionDraft.inverters.split('\n').map(x => x.trim()).filter(Boolean), wattsOptions: optionDraft.wattsOptions.split('\n').map(x => x.trim()).filter(Boolean), categories: optionDraft.categories.split('\n').map(x => x.trim()).filter(Boolean), systemTypes: optionDraft.systemTypes.split('\n').map(x => x.trim()).filter(Boolean) }; const r = await api.patch<typeof quotationOptions>('/quotations/options', payload); setQuotationOptions(r.data); setEditOptions(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save quotation options.'); }
  }

  const [values, setValues] = useState<Record<string, string>>({});
  const [assignees, setAssignees] = useState<Array<{ _id: string; employeeCode: string; firstName: string; lastName: string; role?: { name?: string } }>>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [assigneesError, setAssigneesError] = useState('');
  useEffect(() => {
    if (action !== 'assignment') return;
    let active = true; setAssigneesLoading(true); setAssigneesError(''); setAssignees([]);
    void api.get<typeof assignees>(`/leads/${encodeURIComponent(leadId)}/assignment-options`)
      .then(r => { if (active) setAssignees(r.data); })
      .catch(e => { if (active) setAssigneesError(e instanceof Error ? e.message : 'Unable to load direct reports'); })
      .finally(() => { if (active) setAssigneesLoading(false); });
    return () => { active = false; };
  }, [action, leadId]);

  const quoteRule = quoteRules.find(rule => rule.stateId === quoteState && Number(values.requiredCapacityKW) >= rule.minKW && Number(values.requiredCapacityKW) <= rule.maxKW);
  const [documents, setDocuments] = useState<Partial<Record<ConversionDocumentType, PickedDocument>>>({});
  const [conversionLoading, setConversionLoading] = useState(false);
  const [conversionError, setConversionError] = useState('');
  const [conversionQuoteId, setConversionQuoteId] = useState('');
  useEffect(() => {
    if (action !== 'convert') return;
    let active = true; setConversionLoading(true); setConversionError(''); setConversionQuoteId('');
    void api.get<{ quotation: Record<string, unknown> | null }>(`/customers/from-lead/${encodeURIComponent(leadId)}/options`)
      .then(response => { if (!active) return; const quote = response.data.quotation; if (!quote) return; setConversionQuoteId(String(quote.quotationId ?? '')); setValues(current => { const next = { ...current }; for (const key of ['systemType','phase','category','inverterBattery','requiredCapacityKW','rate','panelCount','wattsPerPanel','paymentMode','panelBrand','panelTechnology','inverter','quotationRemark']) if (quote[key] != null) next[key] = String(quote[key]); return next; }); })
      .catch(e => { if (active) setConversionError(e instanceof Error ? e.message : 'Unable to load quotation details'); })
      .finally(() => { if (active) setConversionLoading(false); });
    return () => { active = false; };
  }, [action, leadId]);


  const loadRecord = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get<unknown>(`/leads/${encodeURIComponent(leadId)}`);
      const data = response.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("The API returned an invalid lead record.");
      }
      setRecord(data as RecordValue);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load lead details.");
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (visible) {
      void loadRecord();
      setHistory([]);
      setHistoryLoaded(false);
      setAction(null);
      setNotice("");
      setDocuments({});
    }
  }, [visible, loadRecord]);

  function openAction(nextAction: LeadAction) {
    setError("");
    setNotice("");
    setAction(nextAction);
    setStatus("");
    setGenerateQuotation(false);
    setDocuments({});
    const current = record ?? {};
    setValues({
      customerName: typeof current.customerName === "string" ? current.customerName : "",
      mobileNumber: typeof current.mobileNumber === "string" ? current.mobileNumber : "",
      alternateNumber: typeof current.alternateNumber === "string" ? current.alternateNumber : "",
      blockOrTehsil: typeof current.blockOrTehsil === "string" ? current.blockOrTehsil : "",
      siteAddress: typeof current.siteAddress === "string" ? current.siteAddress : "",
      assignedTo: current.assignedTo && typeof current.assignedTo === "object" && "_id" in current.assignedTo
        ? String(current.assignedTo._id)
        : "",
      remark: "",
      nextFollowUpDate: "",
      requiredCapacityKW: "",
      ratePerKW: "",
      paymentMode: "",
      panelBrand: "",
      panelTechnology: "",
      termsAndConditions: "",
    });
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setError("");
    try {
      const response = await api.get<unknown>(`/leads/${encodeURIComponent(leadId)}/history`);
      if (!Array.isArray(response.data)) throw new Error("The API returned invalid lead status history.");
      setHistory(response.data.filter((item): item is RecordValue => Boolean(item) && typeof item === "object"));
      setHistoryLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load lead status history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function pickDocument(documentType: ConversionDocumentType) {
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: documentType === "GEO_TAG_PHOTO" ? ["image/jpeg", "image/png", "image/webp"] : ["application/pdf", "image/jpeg", "image/png", "image/webp"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets[0]) {
        setDocuments((current) => ({ ...current, [documentType]: result.assets[0] }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to select this document.");
    }
  }

  async function submitAction() {
    if (!action) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = (key: string) => (values[key] ?? "").trim();
      const objectId = /^[a-f\d]{24}$/i;
      if (action === "status") {
        if (!leadStatuses.includes(status)) throw new Error("Choose a valid lead status.");
        if (!value("remark") || value("remark").length > 1000) throw new Error("Enter a status note (up to 1,000 characters).");
        const payload: Record<string, unknown> = { status, remark: value("remark") };
        if (status === "NEED_FOLLOWUP") {
          const nextDate = new Date(value("nextFollowUpDate"));
          if (!value("nextFollowUpDate") || Number.isNaN(nextDate.getTime()) || nextDate.getTime() <= Date.now()) {
            throw new Error("Choose a future date and time for the next follow-up.");
          }
          payload.nextFollowUpDate = nextDate.toISOString();
        }
        if (generateQuotation) {
          const rate = Number(value("rate")), requiredCapacityKW = Number(value("requiredCapacityKW")), panelCount = Number(value("panelCount")), wattsPerPanel = Number(value("wattsPerPanel"));
          if (status !== "QUOTATION_SENT") throw new Error("Quotation generation is only available for the quotation stage.");
          if (!value("rate") || !Number.isFinite(rate) || rate < 0 || rate > 100000000) throw new Error("Enter a valid rate.");
          if (!value("requiredCapacityKW") || !Number.isFinite(requiredCapacityKW) || requiredCapacityKW <= 0 || requiredCapacityKW > 100000) throw new Error("Enter a valid required capacity in kW.");
          if (!Number.isInteger(panelCount) || panelCount < 1 || !Number.isFinite(wattsPerPanel) || wattsPerPanel <= 0) throw new Error("Enter a valid panel count and watts per panel.");
          if (!value("paymentMode") || !value("panelBrand") || !value("panelTechnology") || !value("inverter") || !value("systemType") || !value("phase") || !value("category") || !value("termsAndConditions")) throw new Error("Complete the quotation details and remark.");
          payload.quotation = { rate, requiredCapacityKW, panelCount, wattsPerPanel, systemType: value("systemType"), phase: value("phase"), category: value("category"), inverterBattery: value("inverterBattery"), paymentMode: value("paymentMode"), panelBrand: value("panelBrand"), panelTechnology: value("panelTechnology"), inverter: value("inverter"), termsAndConditions: value("termsAndConditions") };
        }
        await api.patch(`/leads/${encodeURIComponent(leadId)}/status`, payload);
      } else if (action === "assignment") {
        if (!assignees.some(person => person._id === value("assignedTo"))) throw new Error("Choose an eligible direct report.");
        await api.patch(`/leads/${encodeURIComponent(leadId)}/assignment`, { assignedTo: value("assignedTo") });
      } else if (action === "edit") {
        if (value("customerName").length < 2 || !/^\+?[0-9]{10,15}$/.test(value("mobileNumber"))) {
          throw new Error("Enter a customer name and valid 10–15 digit mobile number.");
        }
        if (value("siteAddress").length < 3) throw new Error("Enter a site address.");
        await api.patch(`/leads/${encodeURIComponent(leadId)}`, {
          customerName: value("customerName"),
          mobileNumber: value("mobileNumber"),
          alternateNumber: value("alternateNumber"),
          blockOrTehsil: value("blockOrTehsil"),
          siteAddress: value("siteAddress"),
        });
      } else {
        const capacity = Number(value("requiredCapacityKW"));
        const rate = Number(value("rate"));
        if (!Number.isFinite(capacity) || capacity <= 0 || capacity > 100000) throw new Error("Enter a valid required capacity.");
        if (!value("rate") || !Number.isFinite(rate) || rate < 0 || rate > 100000000) throw new Error("Enter a valid rate.");
        if (!value("paymentMode") || !value("panelBrand") || !value("panelTechnology") || !value("remark") || !value("systemType") || !value("phase") || !value("category") || !value("inverter") || !value("quotationRemark") || !Number.isInteger(Number(value("panelCount"))) || Number(value("panelCount")) < 1 || Number(value("wattsPerPanel")) <= 0) {
          throw new Error("Complete all project and conversion fields.");
        }
        for (const documentType of conversionDocumentTypes) {
          const file = documents[documentType];
          if (!file) throw new Error(`Choose the required ${documentType.replaceAll("_", " ").toLowerCase()} document.`);
          const mimeType = file.mimeType ?? "";
          if (!(documentType === "GEO_TAG_PHOTO" ? ["image/jpeg", "image/png", "image/webp"] : ["application/pdf", "image/jpeg", "image/png", "image/webp"]).includes(mimeType)) {
            throw new Error(`${documentType.replaceAll("_", " ")} must be a PDF, JPEG, PNG, or WebP file.`);
          }
          if (!file.size || file.size < 1 || file.size > 20 * 1024 * 1024) {
            throw new Error(`${documentType.replaceAll("_", " ")} must be no larger than 20 MB.`);
          }
        }
        const files = conversionDocumentTypes.map((documentType) => {
          const file = documents[documentType];
          if (!file) throw new Error(`Select the ${documentType} file again.`);
          return { documentType, file };
        });
        const reservationResponse = await api.post<Array<{ uploadId: string; documentType: string }>>(
          `/customers/from-lead/${encodeURIComponent(leadId)}/document-upload-urls`,
          {
            documents: files.map(({ documentType, file }) => ({
              documentType,
              fileName: file.name,
              mimeType: file.mimeType,
              fileSize: file.size,
            })),
          },
        );
        const reservations = reservationResponse.data;
        if (!Array.isArray(reservations) || reservations.length !== conversionDocumentTypes.length) {
          throw new Error("The API did not reserve all five required document uploads.");
        }
        for (const reservation of reservations) {
          const file = files.find((entry) => entry.documentType === reservation.documentType)?.file;
          if (!file || !reservation.uploadId || !file.mimeType) throw new Error("The API returned an invalid document upload reservation.");
          const fileResponse = await fetch(file.uri);
          if (!fileResponse.ok) throw new Error(`Unable to read ${file.name}.`);
          const bytes = await fileResponse.arrayBuffer();
          if (bytes.byteLength !== file.size) throw new Error(`${file.name} could not be read completely; please select it again.`);
          try {
            await api.putBinary(
              `/customers/from-lead/${encodeURIComponent(leadId)}/document-uploads/${encodeURIComponent(reservation.uploadId)}`,
              bytes,
              file.mimeType,
            );
          } catch (cause) {
            throw new Error(`${reservation.documentType.replaceAll("_", " ")} upload failed: ${cause instanceof Error ? cause.message : "unknown error"}`);
          }
        }
        await api.post(`/customers/from-lead/${encodeURIComponent(leadId)}`, {
          requiredCapacityKW: capacity,
          ratePerKW: rate, rate, panelCount: Number(value("panelCount")), wattsPerPanel: Number(value("wattsPerPanel")), systemType: value("systemType"), phase: value("phase"), category: value("category"), inverter: value("inverter"), inverterBattery: value("inverterBattery"), quotationRemark: value("quotationRemark"), ...(conversionQuoteId ? { quotationId: conversionQuoteId } : {}),
          paymentMode: value("paymentMode"),
          panelBrand: value("panelBrand"),
          panelTechnology: value("panelTechnology"),
          remark: value("remark"),
          documentUploadIds: reservations.map(({ uploadId }) => uploadId),
        });
      }

      const completedAction = action;
      setAction(null);
      await loadRecord();
      onSaved();
      if (completedAction === "status" && historyLoaded) await loadHistory();
      setNotice(completedAction === "convert" ? "Lead converted to customer successfully." : "Lead updated successfully.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The requested lead action failed.");
    } finally {
      setBusy(false);
    }
  }

  const actionTitle = action === "status" ? "Update lead status"
    : action === "assignment" ? "Assign lead"
      : action === "edit" ? "Edit lead"
        : "Convert lead to customer";

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[92%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 px-5 pb-8 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[10px] font-bold tracking-wide text-brand-navy dark:text-indigo-200">LEAD DETAILS</Text>
              <Text numberOfLines={2} className="mt-1 text-xl font-bold text-brand-ink dark:text-slate-100">
                {record ? primaryLabel(record) : "Loading lead…"}
              </Text>
            </View>
            <Pressable accessibilityLabel="Close lead details" onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800">
              <X size={19} color="#17204f" />
            </Pressable>
          </View>
          <ScrollView className="max-h-[84%]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {loading && !record ? <LoadingState label="Loading lead details…" /> : null}
            {error ? <ErrorNotice message={error} onRetry={() => void loadRecord()} /> : null}
            {notice ? <Text className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</Text> : null}
            {record ? (
              <>
                <View className="mb-4 flex-row flex-wrap gap-2">
                  <ActionButton label="Update lead status" disabled={busy} onPress={() => openAction("status")} />
                  <ActionButton label="Assign lead" disabled={busy} kind="secondary" onPress={() => openAction("assignment")} />
                  <ActionButton label="Edit lead" disabled={busy} kind="secondary" onPress={() => openAction("edit")} />
                  <ActionButton label="Convert to customer" disabled={busy} kind="secondary" onPress={() => openAction("convert")} />
                  <ActionButton label={history.length ? "Refresh status history" : "Status history"} disabled={historyLoading} kind="secondary" icon={Clock3} onPress={() => void loadHistory()} />
                </View>
                {action ? (
                  <Card className="mb-4">
                    <Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">{actionTitle}</Text>
                    {action === "status" ? (
                      <>
                        <Text className="mb-2 text-xs font-semibold text-brand-ink dark:text-slate-100">New status</Text>
                        <View className="mb-3 flex-row flex-wrap gap-2">
                          {leadStatuses.map((item) => (
                            <Pressable key={item} onPress={() => { setStatus(item); setGenerateQuotation(false); }} className={`rounded-full px-3 py-2 ${status === item ? "bg-brand-navy" : "bg-brand-canvas dark:bg-slate-950"}`}>
                              <Text className={`text-xs font-semibold ${status === item ? "text-white" : "text-brand-ink dark:text-slate-100"}`}>{formatValue(item)}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <Field label="Status note" maxLength={1000} multiline numberOfLines={3} onChangeText={(text) => setValue("remark", text)} value={values.remark ?? ""} />
                        {status === "NEED_FOLLOWUP" ? (
                          <DateField label="Next follow-up" includeTime disabled={busy} onChange={(text) => setValue("nextFollowUpDate", text)} value={values.nextFollowUpDate ?? ""} />
                        ) : null}
                        {status === "QUOTATION_SENT" ? (
                          <>
                            <Pressable onPress={() => setGenerateQuotation((current) => !current)} className="mb-3 flex-row items-center gap-2">
                              <View className={`h-5 w-5 items-center justify-center rounded border ${generateQuotation ? "border-brand-navy bg-brand-navy" : "border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800"}`}>
                                {generateQuotation ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                              </View>
                              <Text className="text-sm font-semibold text-brand-ink dark:text-slate-100">Generate quotation now</Text>
                            </Pressable>
                            {generateQuotation ? (
                              <>
                                <Text className="mb-3 text-sm text-brand-muted dark:text-slate-400">Rate is the total project price.</Text>
                                {values.requiredCapacityKW ? (quoteRule ? <Text className="mb-3 text-sm text-brand-ink dark:text-slate-100">Central subsidy: Rs. {quoteRule.central.toLocaleString('en-IN')} | State subsidy: Rs. {quoteRule.state.toLocaleString('en-IN')} {values.rate ? `| Estimated net cost: Rs. ${(Number(values.rate) - quoteRule.central - quoteRule.state).toLocaleString('en-IN')}` : ''}. Subject to approval.</Text> : <Text className="mb-3 text-sm text-red-700">No subsidy setting matches this state and capacity. Ask MD to configure quotation settings.</Text>) : null}
                                {!quotationOptions.panelBrands.length || !quotationOptions.panelTechnologies.length || !quotationOptions.inverters.length || !quotationOptions.wattsOptions.length || !quotationOptions.categories.length || !quotationOptions.systemTypes.length ? <Text className="mb-3 text-sm text-amber-700">An MD must add panel brand, technology, inverter, wattage, category and system type options before a quotation can be generated.</Text> : null}
                                {quotationRole === 'MD' ? <><ActionButton label={editOptions ? 'Close quotation options' : 'Manage quotation options'} kind="secondary" onPress={() => { setOptionDraft({ paymentModes: quotationOptions.paymentModes.join('\n'), panelBrands: quotationOptions.panelBrands.join('\n'), panelTechnologies: quotationOptions.panelTechnologies.join('\n'), inverters: quotationOptions.inverters.join('\n'), wattsOptions: quotationOptions.wattsOptions.join('\n'), categories: quotationOptions.categories.join('\n'), systemTypes: quotationOptions.systemTypes.join('\n') }); setEditOptions(!editOptions); }}/>{editOptions ? <><Text>Enter one option per line. Use positive numbers for watts.</Text>{(['paymentModes','panelBrands','panelTechnologies','inverters','wattsOptions','categories','systemTypes'] as const).map(key => <Field key={key} label={key === 'paymentModes' ? 'Payment modes' : key === 'panelBrands' ? 'Panel brands' : key === 'panelTechnologies' ? 'Panel technologies' : key === 'inverters' ? 'Inverters' : key === 'wattsOptions' ? 'Watts per panel' : key === 'categories' ? 'Categories' : 'System types'} multiline value={optionDraft[key]} onChangeText={text => setOptionDraft(current => ({ ...current, [key]: text }))}/>)}<ActionButton label="Save options" onPress={() => void saveQuotationOptions()}/></> : null}</> : null}
                                <SelectField label="System type" value={values.systemType ?? ''} options={quotationOptions.systemTypes.map(value => ({ value, label: value }))} placeholder="Choose system type" onChange={text => setValue('systemType', text)}/>
                                <SelectField label="Phase" value={values.phase ?? ''} options={[{ value: '1-Phase', label: '1-Phase' }, { value: '3-Phase', label: '3-Phase' }]} placeholder="Choose phase" onChange={text => setValue('phase', text)}/>
                                <SelectField label="Category" value={values.category ?? ''} options={quotationOptions.categories.map(value => ({ value, label: value }))} placeholder="Choose category" onChange={text => setValue('category', text)}/>
                                <Field label="Inverter battery (optional)" value={values.inverterBattery ?? ''} onChangeText={text => setValue('inverterBattery', text)}/>
                                <Field label="Rate" keyboardType="decimal-pad" onChangeText={text => setValue('rate', text)} value={values.rate ?? ''} />
                                <Field label="Number of panels" keyboardType="number-pad" onChangeText={text => setValue('panelCount', text)} value={values.panelCount ?? ''} />
                                <SelectField label="Watts per panel" value={values.wattsPerPanel ?? ''} options={quotationOptions.wattsOptions.map(value => ({ value, label: value }))} placeholder="Choose watts per panel" onChange={text => setValue('wattsPerPanel', text)}/>
                                <Field label="Required capacity (kW)" keyboardType="decimal-pad" onChangeText={text => setValue('requiredCapacityKW', text)} value={values.requiredCapacityKW ?? ''} />
                                <SelectField label="Payment mode" value={values.paymentMode ?? ''} options={quotationOptions.paymentModes.map(value => ({ value, label: value }))} placeholder="Choose payment mode" onChange={text => setValue('paymentMode', text)}/>
                                <SelectField label="Panel brand" value={values.panelBrand ?? ''} options={quotationOptions.panelBrands.map(value => ({ value, label: value }))} placeholder="Choose panel brand" onChange={text => setValue('panelBrand', text)}/>
                                <SelectField label="Panel technology" value={values.panelTechnology ?? ''} options={quotationOptions.panelTechnologies.map(value => ({ value, label: value }))} placeholder="Choose panel technology" onChange={text => setValue('panelTechnology', text)}/>
                                <SelectField label="Inverter" value={values.inverter ?? ''} options={quotationOptions.inverters.map(value => ({ value, label: value }))} placeholder="Choose inverter" onChange={text => setValue('inverter', text)}/>
                                <Field label="Remark" maxLength={5000} multiline numberOfLines={4} onChangeText={text => setValue('termsAndConditions', text)} value={values.termsAndConditions ?? ''} />
                              </>
                            ) : null}
                          </>
                        ) : null}
                      </>
                    ) : null}
                    {action === "assignment" ? (
                      <><SelectField label="Assign to" value={values.assignedTo ?? ""} options={assignees.map(person => ({ value: person._id, label: `${person.firstName} ${person.lastName} (${person.employeeCode}${person.role?.name ? ` - ${person.role.name}` : ""})` }))} placeholder={assignees.length ? "Choose a direct report" : "No eligible direct reports available"} loading={assigneesLoading} onChange={text => setValue("assignedTo", text)}/>{assigneesError ? <ErrorNotice message={assigneesError}/> : null}</>
                    ) : null}
                    {action === "edit" ? (
                      <>
                        <Field label="Customer name" maxLength={160} onChangeText={(text) => setValue("customerName", text)} value={values.customerName ?? ""} />
                        <Field label="Mobile number" keyboardType="phone-pad" onChangeText={(text) => setValue("mobileNumber", text)} value={values.mobileNumber ?? ""} />
                        <Field label="Alternate number" keyboardType="phone-pad" onChangeText={(text) => setValue("alternateNumber", text)} value={values.alternateNumber ?? ""} />
                        <Field label="Block / tehsil" maxLength={120} onChangeText={(text) => setValue("blockOrTehsil", text)} value={values.blockOrTehsil ?? ""} />
                        <Field label="Site address" maxLength={1000} multiline numberOfLines={3} onChangeText={(text) => setValue("siteAddress", text)} value={values.siteAddress ?? ""} />
                      </>
                    ) : null}
                    {action === "convert" ? (
                      <>
                        <Text className="mb-3 text-xs leading-5 text-brand-muted dark:text-slate-400">Quotation details are prefilled when available. Upload all four documents and a geotag photo.</Text>
                        {conversionLoading ? <LoadingState label="Loading quotation details..."/> : null}{conversionError ? <ErrorNotice message={conversionError}/> : null}
                        {(['systemType','phase','category','wattsPerPanel','paymentMode','panelBrand','panelTechnology','inverter'] as const).map(key => {
                          const options = key === 'systemType' ? quotationOptions.systemTypes : key === 'phase' ? ['1-Phase','3-Phase'] : key === 'category' ? quotationOptions.categories : key === 'wattsPerPanel' ? quotationOptions.wattsOptions : key === 'paymentMode' ? quotationOptions.paymentModes : key === 'panelBrand' ? quotationOptions.panelBrands : key === 'panelTechnology' ? quotationOptions.panelTechnologies : quotationOptions.inverters;
                          const names: Record<string,string> = {systemType:'System type',phase:'Phase',category:'Category',wattsPerPanel:'Watts per panel',paymentMode:'Payment mode',panelBrand:'Panel brand',panelTechnology:'Panel technology',inverter:'Inverter'};
                          return <SelectField key={key} label={names[key]} value={values[key] ?? ''} options={Array.from(new Set([values[key], ...options].filter((v): v is string => Boolean(v)))).map(value => ({value,label:value}))} placeholder={`Choose ${names[key].toLowerCase()}`} onChange={text => setValue(key,text)}/>;
                        })}
                        <Field label="Inverter battery (optional)" value={values.inverterBattery ?? ''} onChangeText={text => setValue('inverterBattery',text)}/>
                        <Field label="Required capacity (kW)" keyboardType="decimal-pad" value={values.requiredCapacityKW ?? ''} onChangeText={text => setValue('requiredCapacityKW',text)}/>
                        <Field label="Rate" keyboardType="decimal-pad" value={values.rate ?? ''} onChangeText={text => setValue('rate',text)}/>
                        <Field label="Number of panels" keyboardType="number-pad" value={values.panelCount ?? ''} onChangeText={text => setValue('panelCount',text)}/>
                        <Field label="Remark" value={values.quotationRemark ?? ''} multiline onChangeText={text => setValue('quotationRemark',text)}/>
                        <Field label="Conversion note" maxLength={1000} multiline numberOfLines={3} onChangeText={text => setValue('remark',text)} value={values.remark ?? ''}/>
                        {conversionDocumentTypes.map((documentType) => (
                          <View key={documentType} className="mb-3">
                            <Text className="mb-1.5 text-xs font-semibold text-brand-ink dark:text-slate-100">{formatValue(documentType)} document</Text>
                            <Pressable onPress={() => void pickDocument(documentType)} className="min-h-11 justify-center rounded-xl border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3">
                              <Text numberOfLines={1} className="text-sm text-brand-ink dark:text-slate-100">{documents[documentType]?.name ?? "Choose file (required)"}</Text>
                            </Pressable>
                          </View>
                        ))}
                      </>
                    ) : null}
                    <View className="mt-1 flex-row gap-2">
                      <View className="flex-1"><ActionButton label="Cancel" kind="secondary" disabled={busy} onPress={() => setAction(null)} /></View>
                      <View className="flex-1"><ActionButton label={busy ? (action === "convert" ? "Uploading…" : "Saving…") : action === "convert" ? "Upload & convert" : "Save"} disabled={busy || (action === "convert" && (conversionLoading || !!conversionError))} onPress={() => void submitAction()} /></View>
                    </View>
                  </Card>
                ) : null}
                <Card className="mb-4">
                  <Text className="mb-2 text-base font-bold text-brand-ink dark:text-slate-100">Lead information</Text>
                  {Object.entries(record)
                    .filter(([key, value]) => key !== "__v" && !privateKeys.has(key) && value !== undefined)
                    .map(([key, value]) => (
                      <View key={key} className="border-b border-brand-line dark:border-slate-700 py-3">
                        <Text className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted dark:text-slate-400">{key.replace(/([A-Z])/g, " $1")}</Text>
                        <Text className="mt-1 text-sm leading-5 text-brand-ink dark:text-slate-100">{formatValue(value)}</Text>
                      </View>
                    ))}
                </Card>
                {historyLoaded || historyLoading ? (
                  <Card className="mb-4">
                    <Text className="mb-2 text-base font-bold text-brand-ink dark:text-slate-100">Status history</Text>
                    {historyLoading ? <LoadingState label="Loading status history…" /> : history.map((entry, index) => {
                      const changedBy = entry.changedBy && typeof entry.changedBy === "object" ? entry.changedBy as RecordValue : {};
                      const name = [changedBy.firstName, changedBy.lastName].filter((part): part is string => typeof part === "string" && Boolean(part)).join(" ");
                      return (
                        <View key={String(entry._id ?? index)} className="border-b border-brand-line dark:border-slate-700 py-3">
                          <Text className="text-sm font-bold text-brand-ink dark:text-slate-100">{formatValue(entry.previousStatus)} → {formatValue(entry.newStatus)}</Text>
                          <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">{formatValue(entry.changedAt)}{name ? ` · ${name}` : ""}</Text>
                          {typeof entry.remark === "string" ? <Text className="mt-1 text-sm text-brand-ink dark:text-slate-100">Note: {entry.remark}</Text> : null}
                          {entry.nextFollowUpDate ? <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">Next follow-up: {formatValue(entry.nextFollowUpDate)}</Text> : null}
                        </View>
                      );
                    })}
                    {!historyLoading && !history.length ? <Text className="py-2 text-sm text-brand-muted dark:text-slate-400">No status changes have been recorded for this lead yet.</Text> : null}
                  </Card>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const hiddenVisitField = /password|token|secret|s3key|uploadId|^key$|^__v$|^_id$|^id$/i;
function visitDetailValue(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) return formatVisitDateTime(value);
  const display = formatValue(value);
  if (display === "Linked record" && value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).filter(([key]) => !hiddenVisitField.test(key))
      .map(([key,item]) => `${key.replace(/([A-Z])/g," $1")}: ${visitDetailValue(item)}`).join(", ") || "\u2014";
  }
  return display;
}

function VisitDetailsModal({
  visitId,
  visible,
  onClose,
  onSaved,
}: {
  visitId: string;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [record, setRecord] = useState<RecordValue | null>(null);
  const [history, setHistory] = useState<RecordValue[]>([]);
  const [historyLabel, setHistoryLabel] = useState("");
  const [historyKind, setHistoryKind] = useState<VisitHistoryKind | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");
  const detailRequest = useRef(0);
  const historyRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({ visitDate: "", nextVisitDate: "", remark: "" });

  const loadRecord = useCallback(async () => {
    if (!visitId) return;
    const current = ++detailRequest.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.get<unknown>(`/visits/${encodeURIComponent(visitId)}`);
      if (current !== detailRequest.current) return;
      if (!response.data || typeof response.data !== "object" || Array.isArray(response.data)) {
        throw new Error("The API returned an invalid site visit.");
      }
      const visit = response.data as RecordValue;
      setRecord(visit);
      setValues({
        visitDate: dateTimeInput(visit.visitDate),
        nextVisitDate: dateTimeInput(visit.nextVisitDate),
        remark: typeof visit.remark === "string" ? visit.remark : "",
      });
    } catch (cause) {
      if (current !== detailRequest.current) return;
      setError(cause instanceof Error ? cause.message : "Unable to load site visit details.");
      setRecord(null);
    } finally {
      if (current === detailRequest.current) setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    if (visible) {
      void loadRecord();
      setHistory([]);
      setHistoryLabel("");
      setHistoryKind(null); setHistoryError(""); setNotice("");
      setEditing(false);
    }
    return () => { detailRequest.current += 1; historyRequest.current += 1; };
  }, [visible, loadRecord]);

  async function loadVisitHistory(kind: VisitHistoryKind) {
    const linkedRecord = record?.[kind === "lead" ? "lead" : "visitedBy"];
    const linkedId = linkedRecord && typeof linkedRecord === "object" && "_id" in linkedRecord
      ? String(linkedRecord._id)
      : typeof linkedRecord === "string" ? linkedRecord : "";
    if (!linkedId) {
      setError(`No linked ${kind === "lead" ? "lead" : "employee"} is available for this visit.`);
      return;
    }
    const current = ++historyRequest.current;
    setHistoryKind(kind);
    setHistoryLabel(kind === "lead" ? "Lead visit history" : "Employee visit history");
    setHistory([]); setHistoryError("");
    setHistoryLoading(true);
    try {
      const path = kind === "lead" ? `/visits/leads/${encodeURIComponent(linkedId)}` : `/visits/employees/${encodeURIComponent(linkedId)}`;
      const response = await api.get<unknown>(`${path}?page=1&limit=20`);
      if (current !== historyRequest.current) return;
      const parsed = unwrap(response.data);
      setHistory(parsed.rows);
      setHistoryLabel(kind === "lead" ? "Lead visit history" : "Employee visit history");
    } catch (cause) {
      if (current === historyRequest.current) setHistoryError(cause instanceof Error ? cause.message : "Unable to load visit history.");
    } finally {
      if (current === historyRequest.current) setHistoryLoading(false);
    }
  }

  async function saveVisit() {
    if (busy || !record) return;
    setError(""); setNotice("");
    try {
      const payload = visitUpdatePayload(record, values);
      setBusy(true);
      await api.patch(`/visits/${encodeURIComponent(visitId)}`, payload);
      setEditing(false);
      setNotice("Site visit updated successfully.");
      await loadRecord();
      onSaved();
      if (historyKind) await loadVisitHistory(historyKind);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update site visit.");
    } finally { setBusy(false); }
  }

  return (
    <Modal animationType="slide" onRequestClose={() => { if (!busy) onClose(); }} transparent visible={visible}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[92%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 px-5 pb-8 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[10px] font-bold tracking-wide text-brand-navy dark:text-indigo-200">SITE VISIT DETAILS</Text>
              <Text numberOfLines={2} className="mt-1 text-xl font-bold text-brand-ink dark:text-slate-100">
                {record ? formatVisitDateTime(record.visitDate) : "Loading site visit…"}
              </Text>
            </View>
            <Pressable accessibilityLabel="Close site visit details" disabled={busy} onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800">
              <X size={19} color="#17204f" />
            </Pressable>
          </View>
          <ScrollView className="max-h-[84%]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {loading && !record ? <LoadingState label="Loading site visit details…" /> : null}
            {error ? <ErrorNotice message={error} onRetry={() => void loadRecord()} /> : null}
            {notice ? <Text accessibilityRole="alert" className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</Text> : null}
            {record ? (
              <>
                <View className="mb-4 flex-row flex-wrap gap-2">
                  <ActionButton label={editing ? "Cancel edit" : "Edit visit"} kind={editing ? "secondary" : "primary"} disabled={busy} onPress={() => {
                    if (editing) {
                      setValues({
                        visitDate: dateTimeInput(record.visitDate),
                        nextVisitDate: dateTimeInput(record.nextVisitDate),
                        remark: typeof record.remark === "string" ? record.remark : "",
                      });
                    }
                    setEditing((current) => !current);
                  }} />
                  <ActionButton label="Lead visit history" icon={Clock3} kind="secondary" disabled={historyLoading} onPress={() => void loadVisitHistory("lead")} />
                  <ActionButton label="Employee visit history" icon={Clock3} kind="secondary" disabled={historyLoading} onPress={() => void loadVisitHistory("employee")} />
                </View>
                {editing ? (
                  <Card className="mb-4">
                    <Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">Update site visit</Text>
                    <DateField label="Visit date" includeTime disabled={busy} onChange={(text) => setValues((current) => ({ ...current, visitDate: text }))} value={values.visitDate} />
                    <DateField label="Next visit (optional)" includeTime disabled={busy} onChange={(text) => setValues((current) => ({ ...current, nextVisitDate: text }))} value={values.nextVisitDate} />
                    <Field label="Visit remarks" editable={!busy} maxLength={2000} multiline numberOfLines={4} onChangeText={(text) => setValues((current) => ({ ...current, remark: text }))} value={values.remark} />
                    <ActionButton label={busy ? "Saving…" : "Save visit"} disabled={busy} onPress={() => void saveVisit()} />
                  </Card>
                ) : null}
                <Card className="mb-4">
                  <Text className="mb-2 text-base font-bold text-brand-ink dark:text-slate-100">Visit information</Text>
                  {Object.entries(record)
                    .filter(([key, value]) => !hiddenVisitField.test(key) && !privateKeys.has(key) && value !== undefined)
                    .map(([key, value]) => (
                      <View key={key} className="border-b border-brand-line dark:border-slate-700 py-3">
                        <Text className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted dark:text-slate-400">{key.replace(/([A-Z])/g, " $1")}</Text>
                        <Text className="mt-1 text-sm leading-5 text-brand-ink dark:text-slate-100">{visitDetailValue(value)}</Text>
                      </View>
                    ))}
                </Card>
                {historyLabel ? (
                  <Card className="mb-4">
                    <Text className="mb-2 text-base font-bold text-brand-ink dark:text-slate-100">{historyLabel}</Text>
                    <Text className="mb-3 text-xs leading-5 text-brand-muted dark:text-slate-400">{historyKind === "lead" ? "Visits for this lead, including visits by different employees." : "Visits made by this employee across all accessible leads."}</Text>
                    {historyError ? <ErrorNotice message={historyError} onRetry={() => {if(historyKind)void loadVisitHistory(historyKind);}}/> : null}
                    {historyLoading ? <LoadingState label="Loading visit history…" /> : history.length ? history.map((visit, index) => (
                      <View key={String(visit._id ?? index)} className="border-b border-brand-line dark:border-slate-700 py-3">
                        <Text className="text-sm font-bold text-brand-ink dark:text-slate-100">Visit · {formatVisitDateTime(visit.visitDate)}</Text>
                        {visit.lead ? <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">Lead: {formatValue(visit.lead)}</Text> : null}
                        {visit.lead && typeof visit.lead === "object" && "leadCode" in visit.lead ? <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">Lead code: {String(visit.lead.leadCode)}</Text> : null}
                        {typeof visit.remark === "string" ? <Text className="mt-1 text-sm text-brand-ink dark:text-slate-100">Note: {visit.remark}</Text> : null}
                        {visit.nextVisitDate ? <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">Next visit: {formatVisitDateTime(visit.nextVisitDate)}</Text> : null}
                        {visit.visitedBy ? <Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">Visited by {formatValue(visit.visitedBy)}</Text> : null}
                      </View>
                    )) : !historyError ? <Text className="py-2 text-sm text-brand-muted dark:text-slate-400">No related site visits were found.</Text> : null}
                  </Card>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const privateKeys = new Set(["passwordHash", "failedLoginAttempts", "lockedUntil", "s3Key", "uploadId", "tokenHash", "refreshToken"]);

function CreateRecordModal({
  type,
  visible,
  onClose,
  onSaved,
}: {
  type: ModuleKey;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<SelectOption[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState("");
  const [leadReload, setLeadReload] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setValues({});
    setError("");
  }, [visible, type]);

  useEffect(() => {
    if (!visible || type !== "visits") return;
    let active = true;
    setLeads([]);
    setLeadsLoading(true);
    setLeadsError("");
    void api.get<unknown>("/leads?page=1&limit=100").then((response) => {
      if (active) setLeads(unwrap(response.data).rows.flatMap((lead) => typeof lead._id === "string"
        ? [{ value: lead._id, label: `${lead.leadCode ?? "Lead"} · ${lead.customerName ?? "Unnamed customer"}` }] : []));
    }).catch((cause) => {
      if (active) setLeadsError(cause instanceof Error ? cause.message : "Could not load leads.");
    }).finally(() => { if (active) setLeadsLoading(false); });
    return () => { active = false; };
  }, [visible, type, leadReload]);

  const fields: Record<string, Array<{ key: string; label: string; hint?: string; multiline?: boolean }>> = {
    amc: [
      { key: "customerId", label: "Customer ID", hint: "Open a customer record to find its ID." },
      { key: "startDate", label: "Start date (YYYY-MM-DD)" },
      { key: "expiryDate", label: "Expiry date (YYYY-MM-DD)" },
      { key: "amount", label: "Contract amount" },
      { key: "currency", label: "Currency", hint: "Defaults to INR." },
    ],
  };

  async function submit() {
    setError("");
    const value = (key: string) => (values[key] ?? "").trim();
    const objectId = (text: string) => /^[a-f\d]{24}$/i.test(text);
    let path = "";
    let payload: RecordValue = {};
    try {
      if (type === "leads") {
        path = "/leads";
        payload = createLeadPayload(values);
      } else if (type === "visits") {
        if (!objectId(value("leadId"))) throw new Error("Choose a lead for this visit.");
        if (!value("remark") || value("remark").length > 2000) {
          throw new Error("Visit remarks are required and limited to 2,000 characters.");
        }
        const visitDate = new Date(value("visitDate"));
        if (Number.isNaN(visitDate.getTime()) || visitDate.getTime() > Date.now()) throw new Error("Visit date cannot be in the future.");
        payload = { leadId: value("leadId"), visitDate: visitDate.toISOString(), remark: value("remark") };
        if (value("nextVisitDate")) {
          const nextDate = new Date(value("nextVisitDate"));
          if (Number.isNaN(nextDate.getTime()) || nextDate.getTime() <= Date.now()) throw new Error("Next visit must be in the future.");
          payload.nextVisitDate = nextDate.toISOString();
        }
        path = "/visits";
      } else if (type === "amc") {
        const amount = Number(value("amount"));
        if (!objectId(value("customerId")) || !value("startDate") || !value("expiryDate") || value("expiryDate") <= value("startDate")) {
          throw new Error("Enter a valid customer ID and an expiry date after the start date.");
        }
        if (Number.isNaN(new Date(value("startDate")).getTime()) || Number.isNaN(new Date(value("expiryDate")).getTime())) {
          throw new Error("Enter valid contract dates.");
        }
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid contract amount.");
        const currency = value("currency").toUpperCase() || "INR";
        if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter code.");
        payload = {
          customerId: value("customerId"),
          startDate: new Date(value("startDate")).toISOString(),
          expiryDate: new Date(value("expiryDate")).toISOString(),
          amount,
          currency,
        };
        path = "/amc";
      } else throw new Error("This record type does not support this form.");
      setBusy(true);
      await api.post(path, payload);
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this record.");
    } finally {
      setBusy(false);
    }
  }

  const title = type === "leads" ? "Create lead" : type === "visits" ? "Record site visit" : type === "amc" ? "Register AMC contract" : "Invite employee";
  return (
    <Modal animationType="slide" onRequestClose={() => { if (!busy) onClose(); }} transparent visible={visible}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[90%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 px-5 pb-8 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-[10px] font-bold tracking-[1.4px] text-brand-navy dark:text-indigo-200">NEW RECORD</Text>
              <Text className="mt-1 text-xl font-bold text-brand-ink dark:text-slate-100">{title}</Text>
            </View>
            <Pressable accessibilityLabel="Close new record" disabled={busy} onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800">
              <X size={19} color="#17204f" />
            </Pressable>
          </View>
          <ScrollView className="max-h-[75%]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {type === "leads" ? <LeadCreateFields values={values} disabled={busy} onChange={update=>setValues(current=>({...current,...update}))}/> : type === "visits" ? <>
              <SelectField label="Lead" value={values.leadId ?? ""} options={leads} placeholder="Choose lead" loading={leadsLoading} onChange={(leadId) => setValues((current) => ({ ...current, leadId }))} />
              {leadsError ? <ErrorNotice message={leadsError} onRetry={() => setLeadReload((current) => current + 1)} /> : null}
              {!leadsLoading && !leadsError && !leads.length ? <Text className="mb-4 text-xs text-brand-muted dark:text-slate-400">No leads available in your access scope.</Text> : null}
              <DateField label="Visit date" includeTime value={values.visitDate ?? ""} onChange={(visitDate) => setValues((current) => ({ ...current, visitDate }))} />
              <DateField label="Next visit (optional)" includeTime value={values.nextVisitDate ?? ""} onChange={(nextVisitDate) => setValues((current) => ({ ...current, nextVisitDate }))} />
              <Field label="Visit remarks" multiline numberOfLines={4} maxLength={2000} value={values.remark ?? ""} onChangeText={(remark) => setValues((current) => ({ ...current, remark }))} />
            </> : fields[type]?.map(({ key, label, hint, multiline }) => (
              <View key={key}>
                <Field
                  label={label}
                  autoCapitalize={key === "email" ? "none" : "sentences"}
                  keyboardType={key === "amount" || key === "mobileNumber" ? "numeric" : key === "email" ? "email-address" : "default"}
                  multiline={multiline}
                  numberOfLines={multiline ? 3 : 1}
                  onChangeText={(text) => setValues((current) => ({ ...current, [key]: text }))}
                  placeholder={hint ?? label}
                  value={values[key] ?? ""}
                />
              </View>
            ))}
          </ScrollView>
          {error ? <ErrorNotice message={error} /> : null}
          <View className="flex-row justify-end gap-2">
            <ActionButton label="Cancel" kind="secondary" disabled={busy} onPress={onClose} />
            <ActionButton label={busy ? "Saving…" : "Save record"} icon={Plus} disabled={busy || (type === "visits" && (leadsLoading || !leads.length))} onPress={() => void submit()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function RecordsScreen({
  type,
  onBack,
}: {
  type: ModuleKey;
  onBack: () => void;
}) {
  const config = configs[type];
  const isEmployeeDirectory = type === "employees" || type === "channel-partners";
  const supportsFilters = isEmployeeDirectory || type === "leads" || type === "visits" || type === "customers" || type === "quotations";
  const showFullColumns = supportsFilters;
  const [rows, setRows] = useState<RecordValue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const searchEnabled = Boolean(config?.searchable) && !(type === "leads" && mode !== "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RecordValue | null>(null);
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const roleCode = typeof user?.role === "object" ? user.role?.code : user?.role;
  const organizationView = ["MD", "MIS"].includes(roleCode ?? "") && ["employees", "channel-partners", "leads", "visits", "customers", "quotations", "amc"].includes(type);
  const [filters, setFilters] = useState(emptyRecordFilters);
  const [states, setStates] = useState<SelectOption[]>([]);
  const [districts, setDistricts] = useState<SelectOption[]>([]);
  const [branches, setBranches] = useState<SelectOption[]>([]);
  const [geographyError, setGeographyError] = useState("");
  const [geographyReload, setGeographyReload] = useState(0);
  const [geographyLoading, setGeographyLoading] = useState({ states: false, districts: false, branches: false });
  const requestId = useRef(0);

  useEffect(() => {
    if (!supportsFilters) return;
    let active = true;
    setGeographyError("");
    setGeographyLoading((current) => ({ ...current, states: true }));
    void api.get<unknown>("/geography/states").then((response) => {
      if (active) setStates(geographyOptions(response.data));
    }).catch((cause) => {
      if (active) setGeographyError(cause instanceof Error ? cause.message : "Could not load states.");
    }).finally(() => { if (active) setGeographyLoading((current) => ({ ...current, states: false })); });
    return () => { active = false; };
  }, [supportsFilters, geographyReload]);

  useEffect(() => {
    setDistricts([]);
    setGeographyLoading((current) => ({ ...current, districts: false }));
    if (!supportsFilters || (!filters.stateId && !isEmployeeDirectory)) return;
    let active = true;
    setGeographyError("");
    setGeographyLoading((current) => ({ ...current, districts: true }));
    void api.get<unknown>(filters.stateId ? `/geography/states/${encodeURIComponent(filters.stateId)}/districts` : "/geography/districts").then((response) => {
      if (active) setDistricts(geographyOptions(response.data));
    }).catch((cause) => {
      if (active) setGeographyError(cause instanceof Error ? cause.message : "Could not load districts.");
    }).finally(() => { if (active) setGeographyLoading((current) => ({ ...current, districts: false })); });
    return () => { active = false; };
  }, [supportsFilters, filters.stateId, geographyReload, isEmployeeDirectory]);

  useEffect(() => {
    setBranches([]);
    setGeographyLoading((current) => ({ ...current, branches: false }));
    if (!supportsFilters || (!filters.districtId && !isEmployeeDirectory)) return;
    let active = true;
    setGeographyError("");
    setGeographyLoading((current) => ({ ...current, branches: true }));
    void api.get<unknown>(filters.districtId ? `/geography/districts/${encodeURIComponent(filters.districtId)}/branches` : `/geography/branches${filters.stateId ? "?stateId=" + encodeURIComponent(filters.stateId) : ""}`).then((response) => {
      if (active) setBranches(geographyOptions(response.data));
    }).catch((cause) => {
      if (active) setGeographyError(cause instanceof Error ? cause.message : "Could not load branches.");
    }).finally(() => { if (active) setGeographyLoading((current) => ({ ...current, branches: false })); });
    return () => { active = false; };
  }, [supportsFilters, filters.districtId, filters.stateId, geographyReload, isEmployeeDirectory]);

  function changeFilter(key: keyof typeof emptyRecordFilters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value,
      ...(key === "stateId" ? { districtId: "", branchId: "" } : {}),
      ...(key === "districtId" ? { branchId: "" } : {}),
    }));
  }

  const activeMode = config?.modes?.find((item) => item.value === mode);
  const load = useCallback(async () => {
    if (!config) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), limit: "20" });
      if (type === "employees" || type === "channel-partners") query.set("directory", type === "channel-partners" ? "cp" : "staff");
      if (search.trim() && searchEnabled) query.set("search", search.trim());
      if (activeMode?.days) query.set("days", activeMode.days);
      if (supportsFilters) {
        if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) throw new Error("To date must be on or after from date.");
        if (isEmployeeDirectory) {
          if (filters.stateId) query.set("stateId", filters.stateId);
          if (filters.districtId) query.set("districtId", filters.districtId);
          if (type === "channel-partners" && filters.cpType) query.set("cpType", filters.cpType);
        }
        if (type === "customers" && filters.customerType) query.set("customerType", filters.customerType);
        if (filters.branchId) query.set("branchId", filters.branchId);
        if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) query.set("dateTo", filters.dateTo);
        if (filters.employeeName.trim() && roleCode !== "CP") query.set("employeeName", filters.employeeName.trim());
      }
      const response = await api.get<unknown>(`${activeMode?.endpoint ?? config.endpoint}?${query.toString()}`);
      if (currentRequest !== requestId.current) return;
      const parsed = unwrap(response.data);
      setRows(parsed.rows);
      const envelopeTotal = response.meta && typeof response.meta === "object" && "total" in response.meta ? Number(response.meta.total) : NaN;
      setTotal(Number.isFinite(envelopeTotal) ? envelopeTotal : parsed.total);
    } catch (cause) {
      if (currentRequest !== requestId.current) return;
      setError(cause instanceof Error ? cause.message : `Unable to load ${config.title.toLowerCase()}.`);
      setRows([]);
      setTotal(0);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [activeMode, config, page, search, searchEnabled, supportsFilters, filters, roleCode, type, isEmployeeDirectory]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), config?.searchable || type === "visits" || isEmployeeDirectory ? 250 : 0);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [load, config?.searchable, type, isEmployeeDirectory]);

  const visibleColumns = useMemo(() => {
    if (mode === "follow-ups" || mode === "overdue") {
      return type === "leads"
        ? ["leadCode", "customerName", "mobileNumber", "status", "nextFollowUpDate", "assignedTo"]
        : ["lead", "visitDate", "nextVisitDate", "remark", "visitedBy"];
    }
    if (mode === "schedules") return ["scheduledAt", "contract", "assignedEmployee", "status", "notes"];
    return config?.columns ?? [];
  }, [config?.columns, mode, type]);

  if (!config) return null;

  return (
    <>
      <Page refresh={{ refreshing: loading, onRefresh: () => void load() }}>
        <View className="mb-1 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Heading eyebrow={config.eyebrow} title={config.title} description={organizationView ? `View all ${config.title.toLowerCase()} across the organization.` : config.description} onBack={onBack} />
          </View>
          {config.canCreate && (type !== "channel-partners" || roleCode === "RM") ? (
            <Pressable accessibilityRole="button" accessibilityLabel={type === "leads" ? "New lead" : type === "visits" ? "New visit" : (type === "employees" || type === "channel-partners") ? (type === "channel-partners" ? "New CP" : "New employee") : `New ${config.title.toLowerCase()}`} onPress={() => setCreating(true)} className={`mt-8 h-10 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-navy ${type === "leads" || type === "visits" || (type === "employees" || type === "channel-partners") ? "px-3" : "w-10"}`}>
              <Plus size={19} color="white" />
              {type === "leads" || type === "visits" || (type === "employees" || type === "channel-partners") ? <Text className="text-xs font-bold text-white">{type === "leads" ? "New lead" : type === "visits" ? "New visit" : type === "channel-partners" ? "New CP" : "New employee"}</Text> : null}
            </Pressable>
          ) : null}
        </View>
        {type === "channel-partners" && ["MD", "CP_HEAD", "RM"].includes(roleCode ?? "") ? <CpBulkImport onImported={() => void load()}/> : null}
        <Card className="mb-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-brand-ink dark:text-slate-100">{config.title}</Text>
            <View className="flex-row items-center gap-3">
              <Text className="text-xs text-brand-muted dark:text-slate-400">{total.toLocaleString()} total</Text>
              {showFullColumns ? <RefreshAction loading={loading} onPress={() => void load()} /> : null}
            </View>
          </View>
          {config.searchable ? (
            <View className="mb-3 flex-row items-center rounded-xl border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 px-3">
              <Search size={16} color="#78819b" />
              <TextInput
                accessibilityLabel={`Search ${config.title}`}
                className="ml-2 min-h-11 flex-1 text-sm text-brand-ink dark:text-slate-100"
                maxLength={100}
                onChangeText={(value) => { setPage(1); setSearch(value); }}
                editable={searchEnabled}
                placeholder={searchEnabled ? `Search ${config.title.toLowerCase()}…` : "Choose All leads to search"}
                placeholderTextColor="#9aa1b5"
                value={searchEnabled ? search : ""}
              />
            </View>
          ) : null}
          {supportsFilters ? <>
            {type === "leads" || type === "visits" || isEmployeeDirectory ? <SelectField label="Record view" value={mode} options={(config.modes ?? []).map((item) => ({ value: item.value, label: organizationView && item.value === "downline" ? "Organization team" : item.label }))} placeholder="Choose view" onChange={(value) => { setMode(value || "all"); setPage(1); }} /> : null}
            <View className="mb-3 border-b border-brand-line dark:border-slate-700 pb-1">
              <Text className="mb-3 text-sm font-bold text-brand-ink dark:text-slate-100">Filters</Text>
              <SelectField label="State" value={filters.stateId} options={states} placeholder="All states" loading={geographyLoading.states} onChange={(value) => changeFilter("stateId", value)} />
              <SelectField label="District" value={filters.districtId} options={districts} placeholder="All districts" disabled={!filters.stateId && !isEmployeeDirectory} loading={geographyLoading.districts} onChange={(value) => changeFilter("districtId", value)} />
              <SelectField label="Branch" value={filters.branchId} options={branches} placeholder="All branches" disabled={!filters.districtId && !isEmployeeDirectory} loading={geographyLoading.branches} onChange={(value) => changeFilter("branchId", value)} />
              <View className="flex-row gap-3">
                <View className="flex-1"><DateField label={isEmployeeDirectory ? "Created from" : "From date"} value={filters.dateFrom} onChange={(value) => changeFilter("dateFrom", value)} /></View>
                <View className="flex-1"><DateField label={isEmployeeDirectory ? "Created to" : "To date"} value={filters.dateTo} onChange={(value) => changeFilter("dateTo", value)} /></View>
              </View>
              {roleCode !== "CP" ? <Field label={isEmployeeDirectory ? "Upline/team (includes downline)" : "Employee/team (includes downline)"} accessibilityLabel="Filter by employee name, including their downline" placeholder="Name or employee code" maxLength={100} value={filters.employeeName} onChangeText={(value) => changeFilter("employeeName", value)} /> : null}
              {type === "channel-partners" ? <SelectField label="CP type" value={filters.cpType} options={[{ value: "cp_only", label: "CP only" }, { value: "customer_cp", label: "Customer + CP" }]} placeholder="All channel partners" onChange={value => changeFilter("cpType", value)} /> : null}
              {type === "customers" ? <SelectField label="Customer type" value={filters.customerType} options={[{ value: "customer_only", label: "Only Customer" }]} placeholder="All (Customer + CP)" onChange={value => changeFilter("customerType", value)} /> : null}
              <View className="mb-3 self-start"><ActionButton label="Clear filters" kind="secondary" onPress={() => { setFilters(emptyRecordFilters); setPage(1); }} /></View>
              {geographyError ? <ErrorNotice message={geographyError} onRetry={() => setGeographyReload((current) => current + 1)} /> : null}
            </View>
          </> : config.modes ? (
            <View className="mb-3 flex-row flex-wrap gap-2">
              {config.modes.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => { setPage(1); setMode(item.value); }}
                  className={`rounded-full px-3 py-2 ${mode === item.value ? "bg-brand-navy" : "bg-brand-canvas dark:bg-slate-950"}`}
                >
                  <Text className={`text-xs font-semibold ${mode === item.value ? "text-white" : "text-brand-ink dark:text-slate-100"}`}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {error ? <ErrorNotice message={error} onRetry={() => void load()} /> : null}
          {loading ? <LoadingState label={`Loading ${config.title.toLowerCase()}…`} /> : rows.length ? type === "employees" ? (
            <EmployeeDirectoryTable rows={rows} columns={visibleColumns} display={formatValue} onSelect={setSelected}/>
          ) : (
            <View className="gap-2">
              {rows.map((row, index) => {
                const status = row.status ?? row.isActive;
                return (
                  <Pressable
                    key={String(row._id ?? row.id ?? index)}
                    onPress={() => setSelected(row)}
                    accessibilityRole="button"
                    accessibilityLabel={type === "visits" ? `View site visit for ${formatValue(row.lead)}` : type === "customers" ? `View customer ${primaryLabel(row)}` : type === "quotations" ? `View quotation ${formatValue(row.quotationNumber)}` : (type === "channel-partners") ? `View employee ${primaryLabel(row)}` : undefined}
                    accessibilityHint={type === "leads" ? "Open lead details and actions" : type === "visits" ? "Open site visit details, editing, and history" : type === "customers" ? "Open customer details, documents, and activity" : undefined}
                    className="rounded-xl border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5"
                  >
                    <View className="mb-2 flex-row items-start justify-between gap-3">
                      <Text className="flex-1 text-sm font-bold text-brand-ink dark:text-slate-100">{type === "visits" ? formatValue(row.lead) : type === "quotations" ? formatValue(row.quotationNumber) : primaryLabel(row)}</Text>
                      <View className="flex-row items-center gap-2">
                        {status !== undefined ? (
                          <Text className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${(type === "channel-partners") && status === false ? "bg-brand-canvas dark:bg-slate-950 text-brand-muted dark:text-slate-400" : "bg-emerald-50 text-emerald-800"}`}>
                            {(type === "channel-partners") && typeof status === "boolean" ? status ? "Active" : "Inactive" : formatValue(status)}
                          </Text>
                        ) : null}
                        {type === "leads" || showFullColumns ? <ArrowUpRight size={17} color="#17247a" /> : null}
                      </View>
                    </View>
                    {showFullColumns ? <View className="gap-2">
                      {visibleColumns.map((column) => <View key={column} className="flex-row gap-3">
                        <Text className="w-24 text-xs text-brand-muted dark:text-slate-400">{column.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</Text>
                        <Text className="flex-1 text-xs leading-5 text-brand-ink dark:text-slate-100">{formatValue(row[column])}</Text>
                      </View>)}
                    </View> : <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                      {visibleColumns.filter((column) => column !== "status" && column !== "isActive").slice(0, 3).map((column) => (
                        <Text key={column} numberOfLines={1} className="max-w-[48%] text-[10px] text-brand-muted dark:text-slate-400">
                          {column.replace(/([A-Z])/g, " $1")}: {formatValue(row[column])}
                        </Text>
                      ))}
                    </View>}
                  </Pressable>
                );
              })}
            </View>
          ) : !loading ? <EmptyState label={error ? "No records to display" : "Nothing here yet"} /> : null}
          <View className="mt-4 flex-row items-center justify-between border-t border-brand-line dark:border-slate-700 pt-3">
            <Text className="text-xs text-brand-muted dark:text-slate-400">{showFullColumns ? `Showing ${rows.length ? (page - 1) * 20 + 1 : 0}–${rows.length ? (page - 1) * 20 + rows.length : 0} of ${total.toLocaleString()}` : `Page ${page} · ${total.toLocaleString()} records`}</Text>
            <View className="flex-row gap-2">
              <Pressable
                accessibilityLabel="Previous page"
                disabled={page <= 1 || loading}
                onPress={() => setPage((value) => Math.max(1, value - 1))}
                className="h-9 w-9 items-center justify-center rounded-lg border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft size={17} color="#17204f" />
              </Pressable>
              {showFullColumns ? <Text className="self-center text-xs text-brand-muted dark:text-slate-400">Page {page}</Text> : null}
              <Pressable
                accessibilityLabel="Next page"
                disabled={page * 20 >= total || loading}
                onPress={() => setPage((value) => value + 1)}
                className="h-9 w-9 items-center justify-center rounded-lg border border-brand-line dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight size={17} color="#17204f" />
              </Pressable>
            </View>
          </View>
        </Card>
      </Page>

      {(type === "employees" || type === "channel-partners") && creating ? <EmployeeCreateModal directory={type === "channel-partners" ? "cp" : "staff"} onClose={() => setCreating(false)} onSaved={() => void load()} /> : null}
      {config.canCreate && type !== "employees" && type !== "channel-partners" ? (
        <CreateRecordModal
          type={type}
          visible={creating}
          onClose={() => setCreating(false)}
          onSaved={() => void load()}
        />
      ) : null}
      {type === "leads" && selected ? (
        <LeadDetailsModal
          leadId={String(selected._id ?? selected.id ?? "")}
          visible
          onClose={() => setSelected(null)}
          onSaved={() => void load()}
        />
      ) : null}
      {type === "visits" && selected ? (
        <VisitDetailsModal
          visitId={String(selected._id ?? selected.id ?? "")}
          visible
          onClose={() => setSelected(null)}
          onSaved={() => void load()}
        />
      ) : null}
      {type === "customers" && selected ? <CustomerDetailsModal
        key={String(selected._id ?? selected.id ?? "")}
        customerId={String(selected._id ?? selected.id ?? "")}
        onClose={() => setSelected(null)}
        onSaved={() => void load()}
      /> : null}
      {type === "quotations" && selected ? <QuotationDetailsModal
        key={String(selected._id ?? selected.id ?? "")}
        quotationId={String(selected._id ?? selected.id ?? "")}
        onClose={() => setSelected(null)}
        onSaved={() => void load()}
      /> : null}
      {(type === "employees" || type === "channel-partners") && selected ? <EmployeeDetailsModal
        channelPartner={type === "channel-partners"}
        key={String(selected._id ?? selected.id ?? "")}
        employeeId={String(selected._id ?? selected.id ?? "")}
        onClose={() => setSelected(null)}
        onSaved={() => void load()}
      /> : null}
      {type !== "leads" && type !== "visits" && type !== "customers" && type !== "quotations" && type !== "employees" && type !== "channel-partners" ? <Modal animationType="slide" onRequestClose={() => setSelected(null)} transparent visible={Boolean(selected)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[85%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 px-5 pb-8 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[10px] font-bold tracking-wide text-brand-navy dark:text-indigo-200">{config.title.toUpperCase()} DETAILS</Text>
                <Text numberOfLines={2} className="mt-1 text-xl font-bold text-brand-ink dark:text-slate-100">{selected ? primaryLabel(selected) : ""}</Text>
              </View>
              <Pressable onPress={() => setSelected(null)} className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800">
                <X size={19} color="#17204f" />
              </Pressable>
            </View>
            <View className="max-h-[72%]">
              {selected ? Object.entries(selected)
                .filter(([key]) => key !== "__v" && !privateKeys.has(key))
                .map(([key, value]) => (
                  <View key={key} className="border-b border-brand-line dark:border-slate-700 py-3">
                    <Text className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted dark:text-slate-400">{key.replace(/([A-Z])/g, " $1")}</Text>
                    <Text className="mt-1 text-sm leading-5 text-brand-ink dark:text-slate-100">{formatValue(value)}</Text>
                  </View>
                )) : null}
            </View>
            <Pressable onPress={() => setSelected(null)} className="mt-4 items-center rounded-xl bg-brand-navy py-3">
              <Text className="text-sm font-bold text-white">Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal> : null}
    </>
  );
}
