import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { ActionButton, Card, ErrorNotice } from '../ui';
export default function CallingAvailability() {
  const [active,setActive]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let mounted=true;void api.get<{active:boolean}>('/calling-lists/availability').then(result=>{if(mounted)setActive(result.data.active);}).catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Unable to load availability');});return()=>{mounted=false;};},[]);
  async function update(value:boolean){setBusy(true);setError('');try{const result=await api.patch<{active:boolean}>('/calling-lists/availability',{active:value});setActive(result.data.active);}catch(e){setError(e instanceof Error?e.message:'Unable to update availability');}finally{setBusy(false);}}
  return <Card className="mb-4"><Text className="mb-2 text-base font-bold text-brand-ink dark:text-slate-100">Calling sheet availability: {active===null?'Loading':active?'Active':'Inactive'}</Text><Text className="mb-3 text-xs leading-5 text-brand-muted dark:text-slate-400">When active, you can receive one automatic sheet matching the state and district in your RM details per India calendar day. Your selection stays in effect until you change it. Assignment depends on available sheets and daily distribution being enabled.</Text><View className="flex-row flex-wrap gap-2"><ActionButton label="Active" kind={active?'primary':'secondary'} disabled={busy||active===null||active} onPress={()=>void update(true)}/><ActionButton label="Inactive" kind={active===false?'primary':'secondary'} disabled={busy||active===null||!active} onPress={()=>void update(false)}/></View>{error?<ErrorNotice message={error}/>:null}</Card>;
}
