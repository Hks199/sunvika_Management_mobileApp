import {useEffect,useRef,useState} from 'react';
import {Platform} from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import {api} from './api';
import {notificationsChanged} from './queries';
let registeredToken='';
const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId??process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
const supported=Platform.OS!=='web'&&Device.isDevice&&Constants.executionEnvironment!=='storeClient';
export async function unregisterCpPush(){const token=registeredToken;registeredToken='';if(token)try{await api.post('/push-devices/unregister',{token});}catch{/* Session revocation also prevents future delivery. */}}
export function useCpPush(accountId:string,onOpen:(id:string)=>void){
  const handler=useRef(onOpen);handler.current=onOpen;
  const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  async function register(requestPermission:boolean){
    if(!accountId)return;
    if(!supported||!projectId){setStatus('Phone notifications require the installed app with push setup completed. Your messages remain available in the bell inbox.');return;}
    setBusy(true);
    try{
      const Notifications=await import('expo-notifications');
      if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('cp-reminders',{name:'CP reminders',importance:Notifications.AndroidImportance.HIGH});
      let permission=await Notifications.getPermissionsAsync();
      if(permission.status!=='granted'&&requestPermission)permission=await Notifications.requestPermissionsAsync();
      if(permission.status!=='granted'){setStatus('Enable phone notifications to receive messages when the app is closed.');return;}
      const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
      await api.post('/push-devices',{token,platform:Platform.OS});registeredToken=token;setStatus('Phone notifications are enabled.');
    }catch{setStatus('Unable to enable phone notifications. Check your connection and phone notification permissions, then retry.');}finally{setBusy(false);}
  }
  useEffect(()=>{
    if(!accountId)return;let active=true;let cleanup=()=>{};
    if(!supported||!projectId){setStatus('Phone notifications will be available after app push setup. Scheduled messages still appear in your bell inbox.');return;}
    void import('expo-notifications').then(async Notifications=>{
      if(!active)return;
      Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
      const received=Notifications.addNotificationReceivedListener(()=>notificationsChanged());
      const response=Notifications.addNotificationResponseReceivedListener(event=>{const data=event.notification.request.content.data??{};if(data.type==='CP_REMINDER'&&typeof data.notificationId==='string')handler.current(data.notificationId);});
      const tokenChanged=Notifications.addPushTokenListener(()=>{void register(false);});
      cleanup=()=>{received.remove();response.remove();tokenChanged.remove();};
      const last=await Notifications.getLastNotificationResponseAsync(),data=last?.notification.request.content.data;if(active&&data?.type==='CP_REMINDER'){
        const id=data.notificationId;if(typeof id==='string')handler.current(id);await Notifications.clearLastNotificationResponseAsync();
      }
      if(active)await register(false);
    }).catch(()=>{if(active)setStatus('Phone notification setup is unavailable. Use the bell inbox to read scheduled messages.');});
    return()=>{active=false;cleanup();};
  },[accountId]);
  return {status,busy,enable:()=>void register(true)};
}
