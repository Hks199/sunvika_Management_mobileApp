import { Pressable, ScrollView, Text, View } from "react-native";
import { ArrowUpRight } from "lucide-react-native";
import type { RecordValue } from "../types";

const widths: Record<string,number> = {employeeCode:140,firstName:130,lastName:130,email:230,role:180,isActive:100};
function heading(column:string) {return column.replace(/([A-Z])/g," $1").replace(/^./,letter=>letter.toUpperCase());}
export default function EmployeeDirectoryTable({rows,columns,display,onSelect}: {
  rows:RecordValue[]; columns:string[]; display:(value:unknown)=>string; onSelect:(employee:RecordValue)=>void;
}) {
  const width=columns.reduce((sum,column)=>sum+(widths[column]??140),56);
  return <View>
    <Text className="mb-2 text-xs text-brand-muted">Swipe horizontally to see all employee columns. Tap a row to view details.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
      <View style={{width}} className="overflow-hidden rounded-xl border border-brand-line bg-white">
        <View className="min-h-11 flex-row items-center border-b border-brand-line bg-brand-canvas">
          {columns.map(column=><Text accessibilityRole="header" key={column} style={{width:widths[column]??140}} className="px-3 py-3 text-xs font-bold text-brand-muted">{heading(column)}</Text>)}
          <Text style={{width:56}} className="text-center text-xs text-brand-muted">View</Text>
        </View>
        {rows.map((employee,index)=>{
          const name=[employee.firstName,employee.middleName,employee.lastName].filter(Boolean).join(" ");
          return <Pressable key={String(employee._id??employee.id??index)} accessibilityRole="button" accessibilityLabel={`View employee ${name} ${String(employee.employeeCode??"")}`} accessibilityHint="Open employee details, editing, profile image, and reporting hierarchy" onPress={()=>onSelect(employee)} className="min-h-14 flex-row items-center border-b border-brand-line py-1">
            {columns.map(column=><View key={column} style={{width:widths[column]??140}} className="px-3 py-3">
              {column==="isActive"&&typeof employee.isActive==="boolean" ? <Text className={`self-start rounded-full px-2 py-1 text-[10px] font-semibold ${employee.isActive?"bg-emerald-50 text-emerald-800":"bg-brand-canvas text-brand-muted"}`}>{employee.isActive?"Active":"Inactive"}</Text> : <Text selectable={false} numberOfLines={2} className="text-xs leading-5 text-brand-ink">{display(employee[column])}</Text>}
            </View>)}
            <View style={{width:56}} className="items-center"><ArrowUpRight size={18} color="#17247a"/></View>
          </Pressable>;
        })}
      </View>
    </ScrollView>
  </View>;
}
