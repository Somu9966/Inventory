import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/RootNavigator";
import {
  createTyre,
  deleteTyre,
  DuplicateSkuError,
  getTyre,
  updateTyre,
} from "../db/tyreRepository";
import { saveImageFromPicker } from "../storage/images";
import { TyreInput, VehicleType } from "../types/tyre";

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
  imageUri: string | null;
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
  imageUri: null,
};

const centsToRupeeString = (cents: number) => (cents / 100).toFixed(2);
const rupeeStringToCents = (value: string) => Math.round((Number(value) || 0) * 100);

export default function TyreFormScreen({ route, navigation }: Props) {
  const tyreId = route.params?.tyreId;
  const isEditing = Boolean(tyreId);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tyreId) return;
    (async () => {
      const tyre = await getTyre(tyreId);
      if (!tyre) return;
      setForm({
        sku: tyre.sku,
        brand: tyre.brand,
        model: tyre.model,
        size: tyre.size,
        vehicleType: tyre.vehicleType,
        quantity: String(tyre.quantity),
        costPrice: centsToRupeeString(tyre.costPriceCents),
        sellingPrice: centsToRupeeString(tyre.sellingPriceCents),
        supplier: tyre.supplier ?? "",
        minStockThreshold: String(tyre.minStockThreshold),
        imageUri: tyre.imageUri,
      });
      setLoading(false);
    })();
  }, [tyreId]);

  const update = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // The old file (if any) is left in place until save, so canceling the form
  // never deletes a photo; tyreRepository.updateTyre cleans up the previous
  // file only after a successful write.
  const pickImage = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        source === "camera" ? "Camera access needed" : "Photo access needed",
        "Enable it for Tyre Inventory in your device settings to attach a picture."
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    };

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return;
    const asset = result.assets[0];

    setUploading(true);
    try {
      const uri = await saveImageFromPicker(asset.uri, asset.mimeType);
      setForm((prev) => ({ ...prev, imageUri: uri }));
    } catch {
      Alert.alert("Could not save photo", "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = (): TyreInput => ({
    sku: form.sku.trim(),
    brand: form.brand.trim(),
    model: form.model.trim(),
    size: form.size.trim(),
    vehicleType: form.vehicleType,
    quantity: Number(form.quantity) || 0,
    costPriceCents: rupeeStringToCents(form.costPrice),
    sellingPriceCents: rupeeStringToCents(form.sellingPrice),
    supplier: form.supplier.trim() || null,
    minStockThreshold: Number(form.minStockThreshold) || 0,
    imageUri: form.imageUri,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEditing && tyreId) {
        await updateTyre(tyreId, buildPayload());
      } else {
        await createTyre(buildPayload());
      }
      navigation.goBack();
    } catch (err) {
      const message =
        err instanceof DuplicateSkuError ? err.message : "Please check the form and try again.";
      Alert.alert("Save failed", message);
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
          if (!tyreId) return;
          await deleteTyre(tyreId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Photo</Text>
      {form.imageUri ? (
        <View style={styles.imageWrapper}>
          <Image source={{ uri: form.imageUri }} style={styles.image} />
          {uploading && (
            <View style={styles.imageOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.imagePlaceholder}
          onPress={() => pickImage("library")}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.imagePlaceholderText}>No photo yet</Text>
          )}
        </TouchableOpacity>
      )}

      <View style={styles.imageActions}>
        <TouchableOpacity
          style={styles.imageButton}
          onPress={() => pickImage("camera")}
          disabled={uploading}
        >
          <Text style={styles.imageButtonText}>Take photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.imageButton}
          onPress={() => pickImage("library")}
          disabled={uploading}
        >
          <Text style={styles.imageButtonText}>Choose photo</Text>
        </TouchableOpacity>
        {form.imageUri && !uploading && (
          <TouchableOpacity
            style={styles.imageButton}
            onPress={() => setForm((prev) => ({ ...prev, imageUri: null }))}
          >
            <Text style={[styles.imageButtonText, styles.imageRemoveText]}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>

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
        style={[styles.button, (saving || uploading) && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving || uploading}
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
  imageWrapper: { position: "relative", marginBottom: 8 },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    backgroundColor: "#f2f2f2",
    resizeMode: "cover",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholder: {
    height: 180,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    borderStyle: "dashed",
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  imagePlaceholderText: { color: "#999" },
  imageActions: { flexDirection: "row", gap: 8, marginBottom: 18 },
  imageButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  imageButtonText: { color: "#333", fontWeight: "600", fontSize: 13 },
  imageRemoveText: { color: "#c0392b" },
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
