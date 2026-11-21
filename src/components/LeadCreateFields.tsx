import { useEffect, useState } from "react";
import { Text } from "react-native";
import { api } from "../api";
import { ErrorNotice, Field } from "../ui";
import { SelectField, type SelectOption } from "./VisitFields";

type GeographyKey = "state" | "district" | "branch";
function options(data: unknown): SelectOption[] {
  const rows = Array.isArray(data) ? data : data && typeof data === "object" && "data" in data && Array.isArray(data.data) ? data.data : [];
  return rows.flatMap(row => row && typeof row === "object" && typeof row._id === "string" && typeof row.name === "string" ? [{value:row._id,label:row.name}] : []);
}
function useChoices(path: string | null) {
  const [items,setItems] = useState<SelectOption[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setItems([]); setError(""); setLoading(Boolean(path));
    if (path) void api.get<unknown>(path).then(response => {if(active)setItems(options(response.data));})
      .catch(cause => {if(active)setError(cause instanceof Error ? cause.message : "Unable to load locations.");})
      .finally(() => {if(active)setLoading(false);});
    return () => {active=false;};
  },[path,retry]);
  return {items,loading,error,retry:()=>setRetry(value=>value+1)};
}
export default function LeadCreateFields({values,onChange,disabled}: {
  values:Record<string,string>; onChange:(update:Record<string,string>)=>void; disabled:boolean;
}) {
  const states = useChoices("/geography/states");
  const districts = useChoices(values.state ? `/geography/states/${encodeURIComponent(values.state)}/districts` : null);
  const branches = useChoices(values.district ? `/geography/districts/${encodeURIComponent(values.district)}/branches` : null);
  const choices = {state:states,district:districts,branch:branches};
  return <>
    <Field label="Customer name" maxLength={160} editable={!disabled} value={values.customerName??""} onChangeText={customerName=>onChange({customerName})}/>
    <Field label="Mobile number" maxLength={16} keyboardType="phone-pad" placeholder="10 to 15 digits" editable={!disabled} value={values.mobileNumber??""} onChangeText={mobileNumber=>onChange({mobileNumber})}/>
    <Field label="Alternate number" maxLength={16} keyboardType="phone-pad" placeholder="Optional" editable={!disabled} value={values.alternateNumber??""} onChangeText={alternateNumber=>onChange({alternateNumber})}/>
    {(["state","district","branch"] as GeographyKey[]).map(key => {
      const choice=choices[key];
      const enabled=key==="state" || (key==="district" ? Boolean(values.state) : Boolean(values.district));
      const label=key[0].toUpperCase()+key.slice(1);
      return <Location key={key} label={label} value={values[key]??""} choice={choice} disabled={disabled||!enabled} enabled={enabled} onChange={value=>onChange({[key]:value,...(key==="state"?{district:"",branch:""}:key==="district"?{branch:""}:{})})}/>;
    })}
    <Field label="Block / tehsil" maxLength={120} editable={!disabled} value={values.blockOrTehsil??""} onChangeText={blockOrTehsil=>onChange({blockOrTehsil})}/>
    <Field label="Site address" maxLength={1000} multiline numberOfLines={3} editable={!disabled} value={values.siteAddress??""} onChangeText={siteAddress=>onChange({siteAddress})}/>
  </>;
}
function Location({label,value,choice,disabled,enabled,onChange}:{label:string;value:string;choice:ReturnType<typeof useChoices>;disabled:boolean;enabled:boolean;onChange:(value:string)=>void}) {
  return <>
    <SelectField label={label} value={value} options={choice.items} placeholder={`Choose ${label.toLowerCase()}`} disabled={disabled} loading={choice.loading} onChange={onChange}/>
    {choice.error ? <ErrorNotice message={choice.error} onRetry={choice.retry}/> : enabled&&!choice.loading&&!choice.items.length ? <Text className="mb-3 text-xs text-brand-muted dark:text-slate-400">No active {label.toLowerCase()==="branch"?"branches":label.toLowerCase()==="district"?"districts":"states"} available.</Text> : null}
  </>;
}
