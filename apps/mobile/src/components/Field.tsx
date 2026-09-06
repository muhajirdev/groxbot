import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius } from "../theme";

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  autoCapitalize = "none",
  keyboardType,
  multiline,
  maxLength,
  autoComplete,
}: {
  label?: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  secure?: boolean;
  autoCapitalize?: "none" | "sentences" | "words";
  keyboardType?: "default" | "email-address" | "url" | "number-pad";
  multiline?: boolean;
  maxLength?: number;
  autoComplete?: "email" | "one-time-code" | "off";
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        autoComplete={autoComplete}
        textContentType={
          autoComplete === "one-time-code" ? "oneTimeCode" : undefined
        }
        style={[styles.input, multiline ? styles.multi : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.muted, fontSize: 13 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  multi: { minHeight: 88, textAlignVertical: "top" },
});
