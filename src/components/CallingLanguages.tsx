import {useEffect,useState} from 'react';
import {Text} from 'react-native';
import {api} from '../api';
import {ActionButton,Card,ErrorNotice,Field} from '../ui';
export default function CallingLanguages({onSaved}:{onSaved:(values:string[])=>void}){
 const [text,setText]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{void api.get<string[]>('/calling-lists/languages').then(r=>setText(r.data.join('\n'))).catch(e=>setError(e instanceof Error?e.message:'Unable to load languages'));},[]);
 async function save(){setBusy(true);setError('');try{const values=text.split('\n').map(x=>x.trim()).filter(Boolean);const r=await api.patch<string[]>('/calling-lists/languages',{languages:values});setText(r.data.join('\n'));onSaved(r.data);setNotice('Languages saved.');}catch(e){setError(e instanceof Error?e.message:'Unable to save languages');}finally{setBusy(false);}}
 return <Card className="mb-4"><Text className="mb-2 text-base font-bold text-brand-ink dark:text-slate-100">Manage calling languages</Text><Text className="mb-2 text-xs text-brand-muted dark:text-slate-400">Enter one language per line. RMs and batch uploads use these options.</Text><Field label="Languages" multiline value={text} onChangeText={setText}/><ActionButton label="Save languages" disabled={busy} onPress={()=>void save()}/>{error?<ErrorNotice message={error}/>:null}{notice?<Text>{notice}</Text>:null}</Card>;
}
