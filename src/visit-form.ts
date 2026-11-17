export function dateTimeInput(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function formatVisitDateTime(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "\u2014";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "\u2014" : date.toLocaleString("en-IN", {
    day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
  });
}

// Send only changed fields, preserving existing timestamps and overdue follow-ups.
export function visitUpdatePayload(record: Record<string,unknown>, values: {visitDate:string;nextVisitDate:string;remark:string}, now=Date.now()) {
  const payload: Record<string,unknown> = {};
  if (values.visitDate !== dateTimeInput(record.visitDate)) {
    const date = new Date(values.visitDate);
    if (Number.isNaN(date.getTime()) || date.getTime()>now) throw new Error("Enter a valid visit date and time that is not in the future.");
    payload.visitDate = date.toISOString();
  }
  if (values.nextVisitDate !== dateTimeInput(record.nextVisitDate)) {
    if (!values.nextVisitDate) payload.nextVisitDate = null;
    else {
      const date = new Date(values.nextVisitDate);
      if (Number.isNaN(date.getTime()) || date.getTime()<=now) throw new Error("The next visit must be scheduled for a future date and time.");
      payload.nextVisitDate = date.toISOString();
    }
  }
  const remark = values.remark.trim();
  if (remark !== String(record.remark??"").trim()) {
    if (!remark || remark.length>2000) throw new Error("Enter visit remarks (up to 2,000 characters).");
    payload.remark=remark;
  }
  if (!Object.keys(payload).length) throw new Error("Change a visit field before saving.");
  return payload;
}
