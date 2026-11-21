export type ReportRow = Record<string, unknown>;
export type ReportBar = { label: string; value: number; converted?: number };
export type ReportAnalysis = { rows: ReportRow[]; bars: ReportBar[]; metrics: { label: string; value: string }[]; columns: { key: string; label: string }[]; page: number; limit: number; total?: number; paginated: boolean; barLabel: string };

const number = (value: unknown): number => {
  if (value && typeof value === 'object' && '$numberDecimal' in value) return number((value as { $numberDecimal: unknown }).$numberDecimal);
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};
export const reportLabel = (value: unknown): string => typeof value === 'string' && value.trim() ? value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unspecified';
export const reportDate = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const format = (value: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
export function reportCell(row: ReportRow, key: string): string {
  if (key === 'name') return typeof row.name === 'string' && row.name.trim() ? row.name : 'Unspecified';
  if (key === 'status') return reportLabel(row.status ?? row._id);
  if (key === 'leads') return format(number(row.leads ?? (row.stats as ReportRow | undefined)?.total));
  if (key === 'converted') return format(number(row.converted ?? (row.stats as ReportRow | undefined)?.converted));
  if (key === 'conversion') { const leads = number(row.leads ?? (row.stats as ReportRow | undefined)?.total); const converted = number(row.converted ?? (row.stats as ReportRow | undefined)?.converted); return leads ? `${format(converted / leads * 100)}%` : '—'; }
  if (key === 'quotationDate' || key === 'nextFollowUpDate' || key === 'createdAt') return reportDate(row[key]);
  if (key === 'totalProjectAmount') return `₹${format(number(row[key]))}`;
  if (key === 'requiredCapacityKW') return `${format(number(row[key]))} kW`;
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value : typeof value === 'number' ? format(value) : '—';
}

export function analyzeReport(kind: string, value: unknown): ReportAnalysis {
  const result = value && typeof value === 'object' && !Array.isArray(value) ? value as ReportRow : {};
  const raw = Array.isArray(value) ? value : Array.isArray(result.data) ? result.data : [];
  const rows = raw.filter((row): row is ReportRow => !!row && typeof row === 'object' && !Array.isArray(row));
  const paginated = kind !== 'lead-conversion';
  const page = Math.max(1, number(result.page) || 1), limit = Math.max(1, number(result.limit) || 20);
  const total = typeof result.total === 'number' ? result.total : undefined;
  const performance = kind.endsWith('-performance');
  let bars: ReportBar[];
  let columns: ReportAnalysis['columns'];
  let metrics: ReportAnalysis['metrics'];
  if (performance) {
    bars = rows.map(row => ({ label: reportCell(row, 'name'), value: number(row.leads ?? (row.stats as ReportRow | undefined)?.total), converted: number(row.converted ?? (row.stats as ReportRow | undefined)?.converted) }));
    const leads = bars.reduce((sum, item) => sum + item.value, 0), converted = bars.reduce((sum, item) => sum + (item.converted ?? 0), 0);
    metrics = [{ label: 'Leads', value: format(leads) }, { label: 'Converted', value: format(converted) }, { label: 'Conversion rate', value: leads ? `${format(converted / leads * 100)}%` : '—' }];
    columns = [{ key: 'name', label: kind === 'employee-performance' ? 'Employee' : 'Location' }, ...(kind === 'employee-performance' ? [{ key: 'role', label: 'Role' }] : []), { key: 'leads', label: 'Leads' }, { key: 'converted', label: 'Converted' }, { key: 'conversion', label: 'Conversion rate' }];
  } else {
    const counts = new Map<string, number>();
    rows.forEach(row => { const label = reportLabel(kind === 'lead-conversion' ? row._id : row.status); counts.set(label, (counts.get(label) ?? 0) + (kind === 'lead-conversion' ? number(row.total) : 1)); });
    bars = Array.from(counts, ([label, count]) => ({ label, value: count })).sort((a, b) => b.value - a.value);
    const count = bars.reduce((sum, item) => sum + item.value, 0);
    metrics = [{ label: kind === 'lead-conversion' ? 'Total leads' : 'Records on this page', value: format(count) }, ...(total !== undefined ? [{ label: 'Total matching records', value: format(total) }] : []), { label: 'Statuses', value: format(bars.length) }];
    columns = kind === 'lead-conversion' ? [{ key: 'status', label: 'Lead status' }, { key: 'total', label: 'Leads' }] : kind === 'customers' ? [{ key: 'customerCode', label: 'Customer code' }, { key: 'customerName', label: 'Customer' }, { key: 'status', label: 'Status' }, { key: 'requiredCapacityKW', label: 'Capacity' }, { key: 'createdAt', label: 'Created' }] : kind === 'follow-ups' ? [{ key: 'leadCode', label: 'Lead code' }, { key: 'customerName', label: 'Customer' }, { key: 'status', label: 'Status' }, { key: 'nextFollowUpDate', label: 'Follow-up date' }] : [{ key: 'quotationNumber', label: 'Quotation' }, { key: 'customerName', label: 'Customer' }, { key: 'status', label: 'Status' }, { key: 'totalProjectAmount', label: 'Project value' }, { key: 'quotationDate', label: 'Date' }];
  }
  return { rows, bars, metrics, columns, page, limit, total, paginated, barLabel: performance ? 'Leads and conversions' : 'Records by status' };
}
