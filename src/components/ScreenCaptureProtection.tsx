import {useEffect,useState,type ReactNode} from "react";
import {Platform,Text,View} from "react-native";
import * as ScreenCapture from "expo-screen-capture";
import {ActionButton,LoadingState} from "../ui";

let nextKey=0;
export default function ScreenCaptureProtection({children}:{children:ReactNode}) {
  const [status,setStatus]=useState<"checking"|"ready"|"error">(Platform.OS === "web" ? "ready" : "checking");
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(Platform.OS === "web")return;
    let mounted=true;
    const key=`application-${++nextKey}`;
    void (async()=>{
      try {
        if(!await ScreenCapture.isAvailableAsync())throw new Error("Screen capture protection is unavailable.");
        await ScreenCapture.preventScreenCaptureAsync(key);
        if(mounted)setStatus("ready");
        else await ScreenCapture.allowScreenCaptureAsync(key);
      } catch {
        if(mounted)setStatus("error");
        else void ScreenCapture.allowScreenCaptureAsync(key).catch(()=>{});
      }
    })();
    return ()=>{mounted=false;void ScreenCapture.allowScreenCaptureAsync(key).catch(()=>{});};
  },[attempt]);
  if(status==="checking")return <LoadingState label="Preparing secure application..."/>;
  if(status==="error")return <View className="flex-1 justify-center p-5"><Text className="mb-4 text-sm text-brand-ink dark:text-slate-100">Screen capture protection is unavailable. Update or restart the app, then try again.</Text><ActionButton label="Try again" onPress={()=>{setStatus("checking");setAttempt(v=>v+1);}}/></View>;
  return <>{children}</>;
}
