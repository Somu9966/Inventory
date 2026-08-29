import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/RootNavigator";
import { api } from "../api/client";
import { VehicleType } from "../types/tyre";

type Props = NativeStackScreenProps<AppStackParamList, "TyreForm">;

const VEHICLE_TYPES: VehicleType[] = ["CAR", "BIKE", "TRUCK"];

interface FormState {
  sku: string;
  brand: string;
  model: string;
  size: string;
  vehicleType: VehicleType;
  quantity: string;
  costPrice: string;
  sellingPrice: string;
  supplier: string;
  minStockThreshold: string;
}

const EMPTY_FORM: FormState = {
  sku: "",
  brand: "",
  model: "",
  size: "",
  vehicleType: "CAR",
  quantity: "0",
  costPrice: "",
  sellingPrice: "",
  supplier: "",
  minStockThreshold: "5",
};

export default function TyreFormScreen({ route, navigation }: Props) {
  const tyreId = route.params?.tyreId;
  const isEditing = Boolean(tyreId);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tyreId) return;
    (async () => {
      const { data } = await api.get(`/tyres/${tyreId}`);
      setForm({
        sku: data.sku,
        brand: data.brand,
        model: data.model,
        size: data.size,
        vehicleType: data.vehicleType,
        quantity: String(data.quantity),
        costPrice: String(data.costPrice),
        sellingPrice: String(data.sellingPrice),
        supplier: data.supplier ?? "",
        minStockThreshold: String(data.minStockThreshold),
      });
      setLoading(false);
    })();
  }, [tyreId]);

  const update = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const buildPayload = () => ({
    sku: form.sku.trim(),
    brand: form.brand.trim(),
    model: form.model.trim(),
    size: form.size.trim(),
    vehicleType: form.vehicleType,
    quantity: Number(form.quantity) || 0,
    costPrice: Number(form.costPrice) || 0,
    sellingPrice: Number(form.sellingPrice) || 0,
    supplier: form.supplier.trim() || undefined,
    minStockThreshold: Number(form.minStockThreshold) || 0,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/tyres/${tyreId}`, buildPayload());
      } else {
        await api.post("/tyres", buildPayload());
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Save failed", err?.response?.data?.error ?? "Please check the form and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete tyre", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.delete(`/tyres/${tyreId}`);
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="SKU" value={form.sku} onChangeText={(v) => update("sku", v)} />
      <Field label="Brand" value={form.brand} onChangeText={(v) => update("brand", v)} />
      <Field label="Model" value={form.model} onChangeText={(v) => update("model", v)} />
      <Field
        label="Size (e.g. 195/65 R15)"
        value={form.size}
        onChangeText={(v) => update("size", v)}
      />

      <Text style={styles.label}>Vehicle type</Text>
      <View style={styles.segmented}>
        {VEHICLE_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.segment, form.vehicleType === type && styles.segmentActive]}
            onPress={() => update("vehicleType", type)}
          >
            <Text
              style={[
                styles.segmentText,
                form.vehicleType === type && styles.segmentTextActive,
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Field
        label="Quantity in stock"
        value={form.quantity}
        onChangeText={(v) => update("quantity", v)}
        keyboardType="numeric"
      />
      <Field
        label="Low-stock threshold"
        value={form.minStockThreshold}
        onChangeText={(v) => update("minStockThreshold", v)}
        keyboardType="numeric"
      />
      <Field
        label="Cost price"
        value={form.costPrice}
        onChangeText={(v) => update("costPrice", v)}
        keyboardType="decimal-pad"
      />
      <Field
        label="Selling price"
        value={form.sellingPrice}
        onChangeText={(v) => update("sellingPrice", v)}
        keyboardType="decimal-pad"
      />
      <Field
        label="Supplier"
        value={form.supplier}
        onChangeText={(v) => update("supplier", v)}
      />

      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.buttonText}>{isEditing ? "Save changes" : "Add tyre"}</Text>
      </TouchableOpacity>

      {isEditing && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete tyre</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "numeric" | "decimal-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType ?? "default"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: "#555", marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  segmented: { flexDirection: "row", marginBottom: 14, gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  segmentActive: { backgroundColor: "#1a1a1a", borderColor: "#1a1a1a" },
  segmentText: { color: "#333", fontWeight: "600" },
  segmentTextActive: { color: "#fff" },
  button: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  deleteButton: { alignItems: "center", padding: 14, marginTop: 8 },
  deleteButtonText: { color: "#c0392b", fontWeight: "600" },
});
