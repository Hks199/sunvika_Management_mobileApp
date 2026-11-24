import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { ActionButton, Card, ErrorNotice, LoadingState } from '../ui';

type Customer = { _id: string; customerName: string; customerCode: string; mobileNumber: string; status: string };
type Result = { data: Customer[]; meta: { total: number } };

export default function CpCustomers({ cpId, onSelect, refreshKey }: { cpId: string; onSelect: (id: string) => void; refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError('');
    void api.get<Result>(`/customers?creatorId=${encodeURIComponent(cpId)}&page=${page}&limit=20`)
      .then(response => { if (active) setResult(response.data); })
      .catch(cause => { if (active) { setResult(null); setError(cause instanceof Error ? cause.message : 'Unable to load customers'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cpId, open, page, refreshKey]);
  return <View className="mb-4"><ActionButton label={open ? 'Hide customers' : 'View customers created'} kind="secondary" onPress={() => setOpen(value => !value)}/>
    {open ? <Card className="mt-3"><Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">Customers created by this channel partner</Text>
      {loading ? <LoadingState label="Loading customers..."/> : error ? <ErrorNotice message={error}/> : result?.data.length ? <>
        {result.data.map(customer => <View key={customer._id} className="mb-3 rounded-xl border border-brand-line dark:border-slate-700 p-3"><Text className="font-bold text-brand-ink dark:text-slate-100">{customer.customerName}</Text><Text className="my-2 text-brand-muted dark:text-slate-400">{customer.customerCode} | {customer.mobileNumber} | {customer.status.replace(/_/g, ' ')}</Text><ActionButton label="View customer details" kind="secondary" onPress={() => onSelect(customer._id)}/></View>)}
        <View className="flex-row flex-wrap gap-2"><ActionButton label="Previous" kind="secondary" disabled={page <= 1} onPress={() => setPage(p => p - 1)}/><Text className="text-brand-ink dark:text-slate-100">Page {page}</Text><ActionButton label="Next" kind="secondary" disabled={page * 20 >= result.meta.total} onPress={() => setPage(p => p + 1)}/></View>
      </> : <Text className="text-brand-muted dark:text-slate-400">No customers created by this channel partner.</Text>}
    </Card> : null}
  </View>;
}
