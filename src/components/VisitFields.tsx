import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { ActionButton } from "../ui";

export type SelectOption = { value: string; label: string };

export function SelectField({ label, value, options, placeholder, searchPlaceholder = "Search options...", disabled = false, loading = false, onChange }: {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-semibold text-brand-ink">{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || loading, expanded: open }} disabled={disabled || loading}
        onPress={() => { setSearch(""); setOpen(true); }}
        className={`min-h-12 flex-row items-center justify-between gap-2 rounded-xl border border-brand-line bg-white px-3.5 py-3 ${disabled || loading ? "opacity-50" : ""}`}>
        <Text className={`flex-1 text-sm ${selected ? "text-brand-ink" : "text-brand-muted"}`}>{loading ? "Loading…" : selected?.label ?? placeholder}</Text>
        <ChevronDown size={16} color="#78819b" />
      </Pressable>
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[80%] rounded-t-3xl bg-brand-canvas p-5 pb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-brand-ink">{label}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Close ${label}`} onPress={() => setOpen(false)} className="h-10 w-10 items-center justify-center rounded-full bg-white"><X size={19} color="#17204f" /></Pressable>
            </View>
            <TextInput accessibilityLabel={`Search ${label.toLowerCase()}`} value={search} onChangeText={setSearch} placeholder={searchPlaceholder} placeholderTextColor="#78819b" className="mb-3 min-h-12 rounded-xl border border-brand-line bg-white px-3 text-sm text-brand-ink" />
            <ScrollView keyboardShouldPersistTaps="handled">
              {[{ value: "", label: placeholder }, ...filtered].map((option) => (
                <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: value === option.value }} onPress={() => { onChange(option.value); setOpen(false); }} className="min-h-12 flex-row items-center justify-between gap-3 border-b border-brand-line py-3">
                  <Text className="flex-1 text-sm text-brand-ink">{option.label}</Text>
                  {value === option.value ? <Check size={17} color="#17247a" /> : null}
                </Pressable>
              ))}
              {!filtered.length ? <Text className="py-4 text-sm text-brand-muted">No matching options available.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DateField({ label, value, onChange, includeTime = false, disabled = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  includeTime?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const date = value ? new Date(includeTime ? value : `${value}T00:00`) : null;
  const display = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}) }) : "Choose date";
  const validTime = /^\d{1,2}$/.test(hour) && Number(hour) < 24 && /^\d{1,2}$/.test(minute) && Number(minute) < 60;
  function show() {
    const current = value ? new Date(includeTime ? value : `${value}T00:00`) : new Date();
    const selected = Number.isNaN(current.getTime()) ? new Date() : current;
    setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setDay(localDate(selected));
    setHour(String(selected.getHours()).padStart(2, "0"));
    setMinute(String(selected.getMinutes()).padStart(2, "0"));
    setOpen(true);
  }
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-semibold text-brand-ink">{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={show} className="min-h-12 flex-row items-center justify-between rounded-xl border border-brand-line bg-white px-3.5 py-3">
        <Text className={`flex-1 text-sm ${value ? "text-brand-ink" : "text-brand-muted"}`}>{display}</Text><CalendarDays size={17} color="#78819b" />
      </Pressable>
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-brand-canvas p-5 pb-8">
            <View className="mb-4 flex-row items-center justify-between"><Text className="text-lg font-bold text-brand-ink">{label}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close date picker" onPress={() => setOpen(false)} className="h-10 w-10 items-center justify-center rounded-full bg-white"><X size={19} color="#17204f" /></Pressable></View>
            <View className="mb-3 flex-row items-center justify-between">
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="h-11 w-11 items-center justify-center"><ChevronLeft size={20} color="#17247a" /></Pressable>
              <Text className="font-bold text-brand-ink">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="h-11 w-11 items-center justify-center"><ChevronRight size={20} color="#17247a" /></Pressable>
            </View>
            <View className="flex-row">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((name) => <View key={name} style={{ width: "14.2857%" }} className="items-center py-2"><Text className="text-xs text-brand-muted">{name}</Text></View>)}</View>
            <View className="mb-4 flex-row flex-wrap">
              {Array.from({ length: offset + days }, (_, index) => {
                const number = index - offset + 1;
                const key = localDate(new Date(month.getFullYear(), month.getMonth(), number));
                return <View key={index} style={{ width: "14.2857%" }} className="items-center py-0.5">{number > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={key} accessibilityState={{ selected: day === key }} onPress={() => setDay(key)} className={`h-10 w-10 items-center justify-center rounded-full ${day === key ? "bg-brand-navy" : "bg-white"}`}><Text className={day === key ? "text-white" : "text-brand-ink"}>{number}</Text></Pressable> : <View className="h-10" />}</View>;
              })}
            </View>
            {includeTime ? <View className="mb-4"><Text className="mb-2 text-xs font-semibold text-brand-ink">Time (24-hour)</Text><View className="flex-row items-center gap-2"><TextInput accessibilityLabel="Hour" keyboardType="number-pad" maxLength={2} value={hour} onChangeText={setHour} className="h-12 w-16 rounded-xl border border-brand-line bg-white text-center text-brand-ink" /><Text>:</Text><TextInput accessibilityLabel="Minute" keyboardType="number-pad" maxLength={2} value={minute} onChangeText={setMinute} className="h-12 w-16 rounded-xl border border-brand-line bg-white text-center text-brand-ink" /></View>{!validTime ? <Text className="mt-2 text-xs text-red-800">Enter an hour from 0–23 and minutes from 0–59.</Text> : null}</View> : null}
            <View className="flex-row justify-end gap-2"><ActionButton label="Clear" kind="secondary" disabled={disabled} onPress={() => { onChange(""); setOpen(false); }} /><ActionButton label="Apply" disabled={disabled || !day || (includeTime && !validTime)} onPress={() => { onChange(includeTime ? `${day}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}` : day); setOpen(false); }} /></View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
