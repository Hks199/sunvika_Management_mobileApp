import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { X } from 'lucide-react-native';
import { api } from '../api';
import { SelectField } from '../components/VisitFields';
import { ActionButton, ErrorNotice, Field, LoadingState } from '../ui';
import { cpCustomerDocuments, cpCustomerFields, cpCustomerPayload, type CpCustomerDocument, type CpCustomerOptions, type CustomerPlace } from '../cp-customer';

export default function CpCustomerConversionModal({ cpId, onClose, onSaved }: { cpId: string; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<string, string> | null>(null), [files, setFiles] = useState<Partial<Record<CpCustomerDocument, DocumentPicker.DocumentPickerAsset>>>({});
  const [states, setStates] = useState<CustomerPlace[]>([]), [districts, setDistricts] = useState<CustomerPlace[]>([]), [branches, setBranches] = useState<CustomerPlace[]>([]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  const path = `/customers/from-cp/${encodeURIComponent(cpId)}`;
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void Promise.all([api.get<CpCustomerOptions>(`${path}/options`), api.get<CustomerPlace[]>('/geography/states')]).then(([response, places]) => {
      if (!active) return;
      if (response.data.customerId) { setDraft(null); setError('This CP already has a customer record. Close and refresh the details.'); return; }
      setDraft(response.data.defaults); setStates(places.data);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load conversion'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, reload]);
  useEffect(() => { let active = true; setDistricts([]); if (draft?.state) void api.get<CustomerPlace[]>(`/geography/states/${draft.state}/districts`).then(r => { if (active) setDistricts(r.data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [draft?.state]);
  useEffect(() => { let active = true; setBranches([]); if (draft?.district) void api.get<CustomerPlace[]>(`/geography/districts/${draft.district}/branches`).then(r => { if (active) setBranches(r.data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [draft?.district]);
  function update(key: string, value: string) { setDraft(previous => previous ? { ...previous, [key]: value, ...(key === 'state' ? { district: '', branch: '' } : key === 'district' ? { branch: '' } : {}) } : previous); }
  async function pick(type: CpCustomerDocument) {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!file?.mimeType || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType) || !file.size || file.size > 20 * 1024 * 1024) throw new Error('Choose PDF, JPEG, PNG or WebP up to 20 MB.');
      setFiles(previous => ({ ...previous, [type]: file })); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to select file'); }
  }
  async function convert() {
    if (!draft || busy) return; setBusy(true); setError('');
    try {
      const payload = cpCustomerPayload(draft);
      for (const type of cpCustomerDocuments) if (!files[type]) throw new Error(`Select the ${type.replaceAll('_', ' ')} document.`);
      const response = await api.post<Array<{ uploadId: string; documentType: CpCustomerDocument }>>(`${path}/document-upload-urls`, { documents: cpCustomerDocuments.map(type => { const file = files[type]!; return { documentType: type, fileName: file.name, mimeType: file.mimeType, fileSize: file.size }; }) });
      for (const upload of response.data) {
        const file = files[upload.documentType]; if (!file?.mimeType) throw new Error('Invalid document reservation. Please retry.');
        const local = await fetch(file.uri); if (!local.ok) throw new Error(`Unable to read ${file.name}`);
        const bytes = await local.arrayBuffer(); if (bytes.byteLength !== file.size) throw new Error('The document could not be read completely. Select it again.');
        await api.putBinary(`${path}/document-uploads/${upload.uploadId}`, bytes, file.mimeType);
      }
      await api.post(path, { ...payload, documentUploadIds: response.data.map(upload => upload.uploadId) }); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Conversion failed'); } finally { setBusy(false); }
  }
  function confirm() {
    try { if (!draft) return; cpCustomerPayload(draft); for (const type of cpCustomerDocuments) if (!files[type]) throw new Error(`Select the ${type.replaceAll('_', ' ')} document.`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Complete all required fields'); return; }
    Alert.alert('Convert CP to customer?', 'Create a linked customer record? The CP account and reporting manager will be preserved.', [{ text: 'Cancel', style: 'cancel' }, { text: 'OK, convert', onPress: () => void convert() }]);
  }
  return <Modal transparent animationType="slide" visible onRequestClose={() => { if (!busy) onClose(); }}><View className="flex-1 justify-end bg-black/40"><View className="max-h-[92%] rounded-t-3xl bg-brand-canvas dark:bg-slate-950 p-5 pb-8">
    <View className="mb-3 flex-row items-center justify-between"><Text className="text-xl font-bold text-brand-ink dark:text-slate-100">Convert CP to customer</Text><Pressable disabled={busy} onPress={onClose} accessibilityLabel="Close conversion" className="p-3"><X size={19}/></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled"><Text className="mb-4 text-xs leading-5 text-brand-muted dark:text-slate-400">The channel partner will also become a customer. Complete the customer details and upload all four required documents.</Text>
      {loading ? <LoadingState/> : draft ? <>
        {cpCustomerFields.map(([key, label, type, max]) => <Field key={key} label={label} value={draft[key] ?? ''} maxLength={max} editable={!busy} keyboardType={type === 'number' ? 'decimal-pad' : type === 'tel' ? 'phone-pad' : 'default'} onChangeText={value => update(key, value)}/>)}
        {([['state', 'State', states], ['district', 'District', districts], ['branch', 'Branch', branches]] as const).map(([key, label, places]) => <SelectField key={key} label={label} value={draft[key] ?? ''} options={places.map(place => ({ value: place._id, label: place.name }))} placeholder={`Select ${label.toLowerCase()}`} disabled={busy} onChange={value => update(key, value)}/>)}
        {cpCustomerDocuments.map(type => <View key={type} className="mb-3"><ActionButton label={`Select ${type.replaceAll('_', ' ')}`} disabled={busy} kind="secondary" onPress={() => void pick(type)}/><Text className="mt-1 text-xs text-brand-muted dark:text-slate-400">{files[type]?.name ?? 'Required document'}</Text></View>)}
        <Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">PDF, JPEG, PNG or WebP. Maximum 20 MB per document.</Text>
      </> : null}
      {error ? <ErrorNotice message={error} onRetry={() => setReload(v => v + 1)}/> : null}
      <View className="mt-3 flex-row flex-wrap gap-2"><ActionButton label="Cancel" kind="secondary" disabled={busy} onPress={onClose}/><ActionButton label={busy ? 'Uploading and converting...' : 'Convert to customer'} disabled={busy || loading || !draft} onPress={confirm}/></View>
    </ScrollView>
  </View></View></Modal>;
}
