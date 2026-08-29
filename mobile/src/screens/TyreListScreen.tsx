import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { AppStackParamList } from "../navigation/RootNavigator";
import { api, resolveImageUrl } from "../api/client";
import { Tyre } from "../types/tyre";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<AppStackParamList, "TyreList">;

// Stock gets tapped up and down in bursts, so we hold the running total
// briefly and send one request for the burst instead of one per tap.
const ADJUST_FLUSH_MS = 600;

export default function TyreListScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const pendingDeltas = useRef(new Map<string, number>());
  const flushTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const fetchTyres = useCallback(async (query = "") => {
    setLoading(true);
    try {
      const { data } = await api.get("/tyres", { params: query ? { search: query } : {} });
      setTyres(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  const setQuantity = (id: string, next: (current: number) => number) =>
    setTyres((prev) =>
      prev.map((t) => (t.id === id ? { ...t, quantity: next(t.quantity) } : t))
    );

  const flush = useCallback(async (id: string) => {
    flushTimers.current.delete(id);
    const delta = pendingDeltas.current.get(id) ?? 0;
    pendingDeltas.current.delete(id);
    if (delta === 0) return;

    try {
      const { data } = await api.patch(`/tyres/${id}/quantity`, { delta });
      // Trust the server's number over our optimistic one.
      setQuantity(id, () => data.quantity);
    } catch (err: any) {
      const serverQuantity = err?.response?.data?.quantity;
      if (typeof serverQuantity === "number") {
        setQuantity(id, () => serverQuantity);
      } else {
        setQuantity(id, (current) => current - delta);
      }
      Alert.alert(
        "Could not update stock",
        err?.response?.data?.error ?? "Check your connection and try again."
      );
    }
  }, []);

  const adjust = (tyre: Tyre, delta: number) => {
    if (tyre.quantity + delta < 0) return;

    setQuantity(tyre.id, (current) => current + delta);
    pendingDeltas.current.set(tyre.id, (pendingDeltas.current.get(tyre.id) ?? 0) + delta);

    const existing = flushTimers.current.get(tyre.id);
    if (existing) clearTimeout(existing);
    flushTimers.current.set(tyre.id, setTimeout(() => flush(tyre.id), ADJUST_FLUSH_MS));
  };

  const flushAll = useCallback(() => {
    for (const timer of flushTimers.current.values()) clearTimeout(timer);
    flushTimers.current.clear();
    for (const id of [...pendingDeltas.current.keys()]) flush(id);
  }, [flush]);

  useFocusEffect(
    useCallback(() => {
      fetchTyres(search);
      // Don't lose a half-tapped adjustment by navigating away.
      return flushAll;
    }, [fetchTyres, search, flushAll])
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={logout}>
          <Text style={styles.headerAction}>Log out</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, logout]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search by brand, model, size, SKU"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => fetchTyres(search)}
      />

      <FlatList
        data={tyres}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => fetchTyres(search)} />
        }
        contentContainerStyle={tyres.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>No tyres found</Text> : null
        }
        renderItem={({ item }) => {
          const lowStock = item.quantity <= item.minStockThreshold;
          const atZero = item.quantity === 0;
          return (
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.rowInfo}
                onPress={() => navigation.navigate("TyreForm", { tyreId: item.id })}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: resolveImageUrl(item.imageUrl) }}
                    style={styles.thumbnail}
                  />
                ) : (
                  <View style={[styles.thumbnail, styles.thumbnailEmpty]} />
                )}
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>
                    {item.brand} {item.model} — {item.size}
                  </Text>
                  <Text style={styles.rowSubtitle}>
                    SKU {item.sku} · {item.vehicleType} · ₹{item.sellingPrice}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[styles.stepButton, atZero && styles.stepButtonDisabled]}
                  onPress={() => adjust(item, -1)}
                  disabled={atZero}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                  accessibilityLabel={`Decrease ${item.brand} ${item.model} stock`}
                >
                  <Text style={[styles.stepText, atZero && styles.stepTextDisabled]}>−</Text>
                </TouchableOpacity>

                <View style={[styles.qtyBadge, lowStock && styles.qtyBadgeLow]}>
                  <Text style={[styles.qtyText, lowStock && styles.qtyTextLow]}>
                    {item.quantity}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => adjust(item, 1)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  accessibilityLabel={`Increase ${item.brand} ${item.model} stock`}
                >
                  <Text style={styles.stepText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("TyreForm", undefined)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  search: {
    margin: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  rowInfo: { flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  rowText: { flex: 1 },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: "#f2f2f2",
    resizeMode: "cover",
  },
  thumbnailEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: "#e5e5e5" },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonDisabled: { borderColor: "#eee" },
  stepText: { fontSize: 20, lineHeight: 22, color: "#1a1a1a", fontWeight: "600" },
  stepTextDisabled: { color: "#ccc" },
  qtyBadge: {
    minWidth: 40,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginHorizontal: 6,
    borderRadius: 12,
    backgroundColor: "#eee",
    alignItems: "center",
  },
  qtyBadgeLow: { backgroundColor: "#fdecea" },
  qtyText: { fontWeight: "700", color: "#333" },
  qtyTextLow: { color: "#c0392b" },
  emptyContainer: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#999" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 30 },
  headerAction: { color: "#c0392b", marginRight: 12 },
});
