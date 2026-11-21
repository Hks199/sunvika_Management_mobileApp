import {useEffect,useRef,useState} from 'react';
import {Image,Text,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {api} from '../api';
import {ActionButton,Card,ErrorNotice} from '../ui';
export default function EmployeeProfileImageEditor({employeeId,onSaved}:{employeeId:string;onSaved:()=>Promise<void>}){
  const [options,setOptions]=useState<{canEdit:boolean;maxSizeBytes:number}|null>(null),[file,setFile]=useState<DocumentPicker.DocumentPickerAsset|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0),[checking,setChecking]=useState(false);
  const saving=useRef(false),path=`/employees/${encodeURIComponent(employeeId)}`;
  useEffect(()=>{
    if(!open)return;
    let active=true;setOptions(null);setChecking(true);setError('');
    void api.get<{canEdit:boolean;maxSizeBytes:number}>(`${path}/profile-image-options`)
      .then(result=>{if(active)setOptions(result.data);})
      .catch(e=>{if(active)setError(e instanceof Error&&/^Route not found\b/i.test(e.message)?'Photo editing is unavailable on the connected API. Deploy the updated backend to enable it. Employee details and saved photos can still be viewed.':e instanceof Error?e.message:'Unable to load image permissions');})
      .finally(()=>{if(active)setChecking(false);});
    return()=>{active=false;};
  },[path,reload,open]);
  async function pick(){
    setError('');try{
      const result=await DocumentPicker.getDocumentAsync({type:['image/jpeg','image/png','image/webp'],copyToCacheDirectory:true,multiple:false});if(result.canceled)return;setFile(null);const selected=result.assets[0];
      if(!selected||!['image/jpeg','image/png','image/webp'].includes(selected.mimeType??'')||!selected.size||!options||selected.size>options.maxSizeBytes)throw new Error(`Choose a JPEG, PNG or WebP image up to ${(options?.maxSizeBytes??0)/1024/1024} MB.`);setFile(selected);
    }catch(e){setError(e instanceof Error?e.message:'Unable to choose an image');}
  }
  async function save(){
    if(saving.current||!file||!options?.canEdit)return;saving.current=true;setBusy(true);setError('');setNotice('');
    try{
      const bytes=file.file?await file.file.arrayBuffer():await (await fetch(file.uri)).arrayBuffer();
      if(!bytes.byteLength||bytes.byteLength>options.maxSizeBytes)throw new Error('The selected image is empty or exceeds the upload limit.');
      const type=file.mimeType!;
      const reservation=await api.post<{uploadId:string}>(`${path}/profile-image-upload`,{contentType:type,size:bytes.byteLength});
      await api.putBinary(`${path}/profile-image-upload/${reservation.data.uploadId}`,bytes,type);
      await api.patch(`${path}/profile-image`,{profileImageUploadId:reservation.data.uploadId});
      setFile(null);setOpen(false);setNotice('Profile image updated.');
      try{await onSaved();}catch{setError('The image was saved. Refresh employee details to view it.');}
    }catch(e){setError(e instanceof Error?e.message:'Unable to update profile image. The current image has been kept.');}finally{saving.current=false;setBusy(false);}
  }
  if(options&&!options.canEdit)return null;
  return <View className="mb-4">{!options||options.canEdit?<ActionButton label={open?'Cancel image change':'Change / add profile image'} kind="secondary" disabled={busy||checking} onPress={()=>{setOpen(value=>!value);setFile(null);setError('');setNotice('');}}/>:null}{open&&checking?<Text accessibilityRole="alert" className="my-3 text-xs text-brand-muted dark:text-slate-400">Checking photo editing permissions...</Text>:null}{open&&options?<Card className="mt-3"><ActionButton label="Choose profile image" kind="secondary" disabled={busy} onPress={()=>void pick()}/><Text className="my-3 text-xs text-brand-muted dark:text-slate-400">JPEG, PNG or WebP. Maximum {options.maxSizeBytes/1024/1024} MB.</Text>{file?<><Text className="mb-2 text-xs text-brand-ink dark:text-slate-100">{file.name}</Text><Image source={{uri:file.uri}} accessibilityLabel="Selected profile image preview" resizeMode="contain" style={{width:140,height:140,borderRadius:12,marginBottom:12}}/></>:null}<ActionButton label={busy?'Uploading and saving...':'Save profile image'} disabled={busy||!file} onPress={()=>void save()}/></Card>:null}{notice?<Text accessibilityRole="alert" className="mt-3 text-sm text-emerald-800">{notice}</Text>:null}{error?<ErrorNotice message={error} {...(!options?{onRetry:()=>{setError('');setReload(value=>value+1);}}:{})}/>:null}</View>;
}
