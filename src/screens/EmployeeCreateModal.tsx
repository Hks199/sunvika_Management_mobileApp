import { useEffect, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { X } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../api";
import { useAuth } from "../auth";
import { SelectField, type SelectOption } from "../components/VisitFields";
import { ActionButton, ErrorNotice, Field } from "../ui";
import type { RecordValue } from "../types";

function rows(value: unknown): RecordValue[] {
  const list = Array.isArray(value) ? value : value && typeof value === "object" ? (value as RecordValue).data ?? (value as RecordValue).items : [];
  return Array.isArray(list) ? list.filter((item): item is RecordValue => Boolean(item) && typeof item === "object") : [];
}
function options(value: unknown): SelectOption[] {
  return rows(value).flatMap((item) => typeof item._id === "string" && typeof item.name === "string" ? [{ value: item._id, label: item.name }] : []);
}
function normalized(value: unknown) { return typeof value === "string" ? value.trim().toUpperCase().replace(/[\s-]+/g, "_") : ""; }
const fields = [
  { key: "employeeCode", label: "Employee code", max: 40, placeholder: "e.g. SVK-EMP-001" },
  { key: "firstName", label: "First name", max: 80 },
  { key: "lastName", label: "Last name", max: 80 },
  { key: "email", label: "Work email", max: 254 },
  { key: "mobileNumber", label: "Mobile number", max: 16 },
  { key: "addressLine", label: "Address", max: 300 },
  { key: "city", label: "City", max: 100 },
  { key: "pincode", label: "Postal code", max: 12 },
];

export default function EmployeeCreateModal({ onClose, onSaved, directory = "all" }: { onClose: () => void; onSaved: () => void; directory?: "all" | "staff" | "cp" }) {
  const { user } = useAuth();
  const actorRoleCode = normalized(typeof user?.role === "string" ? user.role : user?.role?.code);
  const [values, setValues] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<SelectOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleError, setRoleError] = useState("");
  const [states, setStates] = useState<SelectOption[]>([]);
  const [districts, setDistricts] = useState<SelectOption[]>([]);
  const [branches, setBranches] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState({ states: false, districts: false, branches: false });
  const [geographyError, setGeographyError] = useState("");
  const [reload, setReload] = useState(0);
  const [roleReload, setRoleReload] = useState(0);
  const [image, setImage] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadedImage, setUploadedImage] = useState<{ file: DocumentPicker.DocumentPickerAsset; uploadId: string } | null>(null);
  const stateId = values.state ?? "";
  const districtId = values.district ?? "";
  const directCp = actorRoleCode === "RM" && (directory === "cp" || values.roleCode === "CP");

  useEffect(() => {
    let active = true;
    setRolesLoading(true); setRoleError(""); setRoles([]);
    void api.get<unknown>("/employees/creatable-roles").then((response) => {
      if (!active) return;
      const available = rows(response.data).flatMap((role) => typeof role._id === "string" && typeof role.name === "string" && typeof role.code === "string" && (directory === "all" || (directory === "cp" ? normalized(role.code) === "CP" : normalized(role.code) !== "CP")) && !["ADMIN_HEAD", "MH", "MARKETING_HEAD"].includes(normalized(role.code)) && (normalized(role.code) !== "CP_HEAD" || actorRoleCode === "MD") && !["ADMIN_HEAD", "MARKETING_HEAD"].includes(normalized(role.name))
        ? [{ value: role.code, label: `${role.name} (${role.code})` }] : []);
      setRoles(available);
      if (!available.length) setRoleError("No employee roles are configured for your account.");
    }).catch((cause) => { if (active) setRoleError(cause instanceof Error ? cause.message : "Could not load employee roles."); })
      .finally(() => { if (active) setRolesLoading(false); });
    return () => { active = false; };
  }, [roleReload, actorRoleCode, directory]);

  useEffect(() => {
    let active = true;
    setGeographyError(""); setLoading((current) => ({ ...current, states: true }));
    void api.get<unknown>("/geography/states").then((response) => { if (active) setStates(options(response.data)); })
      .catch((cause) => { if (active) setGeographyError(cause instanceof Error ? cause.message : "Could not load states."); })
      .finally(() => { if (active) setLoading((current) => ({ ...current, states: false })); });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    setDistricts([]); setLoading((current) => ({ ...current, districts: false }));
    if (!stateId) return;
    let active = true;
    setLoading((current) => ({ ...current, districts: true }));
    void api.get<unknown>(`/geography/states/${encodeURIComponent(stateId)}/districts`).then((response) => { if (active) setDistricts(options(response.data)); })
      .catch((cause) => { if (active) setGeographyError(cause instanceof Error ? cause.message : "Could not load districts."); })
      .finally(() => { if (active) setLoading((current) => ({ ...current, districts: false })); });
    return () => { active = false; };
  }, [stateId, reload]);

  useEffect(() => {
    setBranches([]); setLoading((current) => ({ ...current, branches: false }));
    if (!districtId) return;
    let active = true;
    setLoading((current) => ({ ...current, branches: true }));
    void api.get<unknown>(`/geography/districts/${encodeURIComponent(districtId)}/branches`).then((response) => { if (active) setBranches(options(response.data)); })
      .catch((cause) => { if (active) setGeographyError(cause instanceof Error ? cause.message : "Could not load branches."); })
      .finally(() => { if (active) setLoading((current) => ({ ...current, branches: false })); });
    return () => { active = false; };
  }, [districtId, reload]);

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value, ...(key === "state" ? { district: "", branch: "" } : key === "district" ? { branch: "" } : {}) }));
  }
  async function pickImage() {
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "image/webp"], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets[0]) return;
      const file = result.assets[0];
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimeType ?? "") || !file.size || file.size > 10 * 1024 * 1024) throw new Error("Profile image must be JPEG, PNG, or WebP and no larger than 10 MB.");
      setImage(file); setUploadedImage(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to select profile image."); }
  }
  async function submit() {
    if (busy) return;
    setError("");
    const value = (key: string) => (values[key] ?? "").trim();
    const objectId = (text: string) => /^[a-f\d]{24}$/i.test(text);
    try {
      const employeeCode = value("employeeCode").toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(employeeCode)) throw new Error("Employee code must be 2–40 characters using letters, numbers, hyphens, or underscores.");
      if (!value("firstName") || value("firstName").length > 80 || !value("lastName") || value("lastName").length > 80) throw new Error("First and last names are required (up to 80 characters).");
      const email = value("email").toLowerCase();
      if ((!directCp || email) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) throw new Error("Enter a valid work email address.");
      const password = values.password ?? "";
      if (directCp && (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,72}$/.test(password) || encodeURIComponent(password).replace(/%[A-F\d]{2}|./gi, 'x').length > 72)) throw new Error("Use 12 to 72 bytes with uppercase, lowercase and a number for the password.");
      if (directCp && password !== (values.confirmPassword ?? "")) throw new Error("Passwords do not match.");
      if (!/^\+?[1-9]\d{7,14}$/.test(value("mobileNumber"))) throw new Error("Enter a valid mobile number.");
      if (!roles.some((role) => role.value === value("roleCode"))) throw new Error("Select a valid role.");
      if (value("addressLine").length < 3 || value("addressLine").length > 300 || !objectId(stateId) || !objectId(districtId)) throw new Error("Enter an address and select its state and district.");
      if (value("city").length > 100 || (value("pincode") && !/^[A-Za-z0-9 -]{3,12}$/.test(value("pincode")))) throw new Error("Check the city and postal code.");
      if (value("branch") && !objectId(value("branch"))) throw new Error("Select a valid branch.");
      const payload: RecordValue = { employeeCode, firstName: value("firstName"), lastName: value("lastName"), ...(email ? { email } : {}), ...(directCp ? { password } : {}), mobileNumber: value("mobileNumber"), roleCode: value("roleCode"),
        address: { addressLine: value("addressLine"), state: stateId, district: districtId, ...(value("city") ? { city: value("city") } : {}), ...(value("pincode") ? { pincode: value("pincode") } : {}) }, ...(value("branch") ? { branch: value("branch") } : {}) };
      setBusy(true);
      if (image) {
        let uploadId = uploadedImage?.file === image ? uploadedImage.uploadId : "";
        if (!uploadId) {
          const content = image.file ? await image.file.arrayBuffer() : await (await fetch(image.uri)).arrayBuffer();
          if (!content.byteLength || content.byteLength > 10 * 1024 * 1024) throw new Error("Profile image must be nonempty and no larger than 10 MB.");
          const reservation = await api.post<{ uploadId?: string }>("/employees/profile-image-upload", { contentType: image.mimeType, size: content.byteLength });
          uploadId = reservation.data?.uploadId ?? "";
          if (!uploadId) throw new Error("Could not prepare the profile image upload.");
          await api.putBinary(`/employees/profile-image-upload/${encodeURIComponent(uploadId)}`, content, image.mimeType!);
          setUploadedImage({ file: image, uploadId });
        }
        payload.profileImageUploadId = uploadId;
      }
      const result = await api.post<{ invitationSent: boolean; credentialsCreated?: boolean }>("/employees", payload);
      onSaved(); onClose();
      if (result.data.credentialsCreated) Alert.alert("Channel partner created", `User ID: ${employeeCode}. Share the password securely.`);
      else if (!result.data.invitationSent) Alert.alert("Employee created", "The invitation email could not be sent. Do not create the employee again. Open the employee details and resend the invitation after email is fixed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not invite employee."); }
    finally { setBusy(false); }
  }

  return <Modal transparent animationType="slide" visible onRequestClose={() => { if (!busy) onClose(); }}>
    <View className="flex-1 justify-end bg-black/40"><View className="max-h-[92%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 px-5 pb-8 pt-5">
      <View className="mb-4 flex-row items-center justify-between"><View><Text className="text-[10px] font-bold tracking-wide text-brand-navy dark:text-indigo-200">TEAM ONBOARDING</Text><Text className="mt-1 text-xl font-bold text-brand-ink dark:text-slate-100">{directCp ? "Create channel partner" : "Invite employee"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close employee invitation" disabled={busy} onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800"><X size={19} color="#17204f" /></Pressable></View>
      <ScrollView className="max-h-[78%]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {fields.slice(0, 6).map((field) => <Field key={field.key} label={directCp && field.key === "employeeCode" ? "User ID (CP code)" : directCp && field.key === "email" ? "Email (optional)" : field.label} accessibilityLabel={field.label} maxLength={field.max} value={values[field.key] ?? ""} onChangeText={(value) => setValue(field.key, value)} editable={!busy} placeholder={field.placeholder ?? field.label} autoCapitalize={field.key === "email" ? "none" : field.key === "employeeCode" ? "characters" : "words"} keyboardType={field.key === "email" ? "email-address" : field.key === "mobileNumber" ? "phone-pad" : "default"} />)}
        {directCp ? <><Field label="Password" secureTextEntry autoCapitalize="none" autoComplete="new-password" maxLength={72} value={values.password ?? ""} onChangeText={value => setValue("password", value)} editable={!busy}/><Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">Use 12 to 72 bytes with uppercase, lowercase and a number.</Text><Field label="Confirm password" secureTextEntry autoCapitalize="none" autoComplete="new-password" maxLength={72} value={values.confirmPassword ?? ""} onChangeText={value => setValue("confirmPassword", value)} editable={!busy}/></> : null}
        <SelectField label="Role" value={values.roleCode ?? ""} options={roles} placeholder={roles.length ? "Choose role" : "No roles available"} loading={rolesLoading} disabled={busy || !roles.length} onChange={(value) => setValue("roleCode", value)} />
        {roleError ? <ErrorNotice message={roleError} onRetry={() => setRoleReload((current) => current + 1)} /> : null}
        {fields.slice(6).map((field) => <Field key={field.key} label={field.label} accessibilityLabel={field.label} maxLength={field.max} value={values[field.key] ?? ""} onChangeText={(value) => setValue(field.key, value)} editable={!busy} />)}
        <SelectField label="State" value={stateId} options={states} placeholder="Choose state" loading={loading.states} disabled={busy} onChange={(value) => setValue("state", value)} />
        <SelectField label="District" value={districtId} options={districts} placeholder="Choose district" loading={loading.districts} disabled={busy || !stateId} onChange={(value) => setValue("district", value)} />
        {stateId && !loading.districts && !districts.length ? <Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">No active districts for this state.</Text> : null}
        <SelectField label="Branch (optional)" value={values.branch ?? ""} options={branches} placeholder="No branch" loading={loading.branches} disabled={busy || !districtId} onChange={(value) => setValue("branch", value)} />
        {districtId && !loading.branches && !branches.length ? <Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">No active branches for this district.</Text> : null}
        {geographyError ? <ErrorNotice message={geographyError} onRetry={() => setReload((current) => current + 1)} /> : null}
        <Text className="mb-2 text-xs font-semibold text-brand-ink dark:text-slate-100">Profile image (optional, JPEG, PNG, WebP · max 10 MB)</Text>
        <ActionButton label={image ? "Change profile image" : "Choose profile image"} kind="secondary" disabled={busy} onPress={() => void pickImage()} />
        {image ? <View className="my-3"><Image accessibilityLabel="Selected profile image" source={{ uri: image.uri }} style={{ width: 88, height: 88, borderRadius: 12 }} /><Text className="my-2 text-xs text-brand-muted dark:text-slate-400">{image.name}</Text><ActionButton label="Remove image" kind="secondary" disabled={busy} onPress={() => { setImage(null); setUploadedImage(null); }} /></View> : null}
        {error ? <View className="mt-3"><ErrorNotice message={error} /></View> : null}
      </ScrollView>
      <View className="mt-4 flex-row justify-end gap-2"><ActionButton label="Cancel" kind="secondary" disabled={busy} onPress={onClose} /><ActionButton label={busy ? "Saving…" : "Send invitation"} disabled={busy || rolesLoading || !roles.length} onPress={() => void submit()} /></View>
    </View></View>
  </Modal>;
}
