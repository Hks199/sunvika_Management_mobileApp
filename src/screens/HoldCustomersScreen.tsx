import { useAuth } from '../auth';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { ActionButton, Card, ErrorNotice, Heading, LoadingState, Page } from '../ui';
import CustomerDetailsModal from './CustomerDetailsModal';

type Customer = { _id: string; customerCode: string; customerName: string; mobileNumber: string; status: string; reviewStatus?: string };
export default function HoldCustomersScreen({ onBack, review = false }: { onBack: () => void; review?: boolean }) {
  const { user } = useAuth();
  const role = typeof user?.role === "string" ? user.role : user?.role?.code;
  const [rows, setRows] = useState<Customer[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await api.get<Customer[]>(review ? '/customers/review-queue' : '/customers/hold'); setRows(response.data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load held customers'); }
    finally { setLoading(false); }
  }, [review]);
  useEffect(() => { void load(); }, [load]);
  return <Page><Heading eyebrow="CUSTOMER DOCUMENTS" title={review ? "New customers" : "Hold customers"} description={review ? role === "MIS" ? "Verify each RM-approved document or mark it pending with a remark." : "Customers remain here until their required documents are verified." : "Review the RM's remark, preview or download rejected documents, and upload replacements."} onBack={onBack}/>
    <View className="mb-4"><ActionButton label="Refresh" kind="secondary" disabled={loading} onPress={() => void load()}/></View>
    {loading ? <LoadingState label="Loading held customers..."/> : error ? <ErrorNotice message={error} onRetry={() => void load()}/> : rows.length ? rows.map(customer => <Card key={customer._id} className="mb-3"><Text className="text-base font-bold text-brand-ink dark:text-slate-100">{customer.customerName}</Text><Text className="my-2 text-brand-muted dark:text-slate-400">{customer.customerCode} | {customer.mobileNumber} | {review ? (customer.reviewStatus === 'REJECTED' ? 'Rejected - replacement needed' : customer.reviewStatus === 'MIS_PENDING' ? 'Awaiting MIS verification' : 'Awaiting RM verification') : customer.status}</Text><ActionButton label="View documents" kind="secondary" onPress={() => setSelected(customer._id)}/></Card>) : <Text className="text-brand-muted dark:text-slate-400">{review ? 'No unverified customers in your team.' : 'No customers are currently on hold.'}</Text>}
    {selected ? <CustomerDetailsModal customerId={selected} onClose={() => { setSelected(''); void load(); }} onSaved={() => void load()}/> : null}
  </Page>;
}
