import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { ActionButton, Card, ErrorNotice } from '../ui';
type Settings = { enabled: boolean; skipUnfinished: boolean };
type Batch = { _id: string; title: string; state: string; candidateCount: number; sheetCount: number; error: string };
export default function CallingBulkPanel({ refreshKey }: { refreshKey: number }) {
  const [settings, setSettings] = useState<Settings | null>(null), [batches, setBatches] = useState<Batch[]>([]);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { const [config, result] = await Promise.all([api.get<Settings>('/calling-lists/distribution'), api.get<{ data: Batch[]; total: number }>(`/calling-lists/batches?page=${page}&limit=10`)]); setSettings(config.data); setBatches(result.data.data); setTotal(result.data.total); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load batches'); } finally { setBusy(false); }
  }, [page]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  async function save() {
    if (!settings) return; setBusy(true); setError(''); setNotice('');
    try { await api.patch('/calling-lists/distribution', { enabled: settings.enabled, skipUnfinished: settings.skipUnfinished }); setNotice('Daily distribution settings saved.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save settings'); } finally { setBusy(false); }
  }
  async function retry(id: string) { setBusy(true); setError(''); try { await api.post(`/calling-lists/batches/${id}/retry`); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to retry batch'); } finally { setBusy(false); } }
  return <Card className="mb-4"><Text className="mb-2 text-lg font-bold text-brand-ink dark:text-slate-100">Daily allocation · 9:30 AM IST</Text><Text className="mb-4 text-xs leading-5 text-brand-muted dark:text-slate-400">Unassigned candidates stay in private S3 files. They enter the database only when assigned. Refresh manually to see import progress.</Text>
    {settings ? <View className="mb-4 gap-3"><ActionButton label={`Daily assignment: ${settings.enabled ? 'ON' : 'OFF'}`} kind="secondary" disabled={busy} onPress={() => setSettings({ ...settings, enabled: !settings.enabled })}/><ActionButton label={`Wait for earlier uncalled candidates: ${settings.skipUnfinished ? 'ON' : 'OFF'}`} kind="secondary" disabled={busy} onPress={() => setSettings({ ...settings, skipUnfinished: !settings.skipUnfinished })}/><ActionButton label="Save allocation settings" disabled={busy} onPress={() => void save()}/></View> : null}
    {error ? <ErrorNotice message={error} onRetry={() => void load()}/> : null}{notice ? <Text className="mb-3 text-sm text-emerald-700">{notice}</Text> : null}
    <Text className="mb-3 text-base font-bold text-brand-ink dark:text-slate-100">Upload batches ({total})</Text><ActionButton label="Refresh batches" kind="secondary" disabled={busy} onPress={() => void load()}/>
    {batches.map(batch => <View key={batch._id} className="mt-3 border-t border-brand-line dark:border-slate-700 pt-3"><Text className="font-bold text-brand-ink dark:text-slate-100">{batch.title}</Text><Text className="my-2 text-xs text-brand-muted dark:text-slate-400">{batch.state} · {batch.candidateCount.toLocaleString()} candidates processed · {batch.sheetCount.toLocaleString()} sheets</Text>{batch.error ? <Text className="mb-2 text-xs text-red-700">{batch.error}</Text> : null}{batch.state === 'FAILED' ? <ActionButton label="Retry processing" kind="secondary" disabled={busy} onPress={() => void retry(batch._id)}/> : null}</View>)}
    {!batches.length ? <Text className="my-3 text-xs text-brand-muted dark:text-slate-400">No upload batches yet.</Text> : null}<View className="mt-4 flex-row items-center gap-2"><ActionButton label="Previous" kind="secondary" disabled={busy || page === 1} onPress={() => setPage(v => v - 1)}/><Text>Page {page}</Text><ActionButton label="Next" kind="secondary" disabled={busy || page * 10 >= total} onPress={() => setPage(v => v + 1)}/></View>
  </Card>;
}
