import React, { useCallback, useState } from "react";
import {
  FlatList,
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
import { api } from "../api/client";
import { Tyre } from "../types/tyre";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<AppStackParamList, "TyreList">;

export default function TyreListScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTyres = useCallback(async (query = "") => {
    setLoading(true);
    try {
      const { data } = await api.get("/tyres", { params: query ? { search: query } : {} });
      setTyres(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTyres(search);
    }, [fetchTyres, search])
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
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate("TyreForm", { tyreId: item.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {item.brand} {item.model} — {item.size}
                </Text>
                <Text style={styles.rowSubtitle}>
                  SKU {item.sku} · {item.vehicleType} · ₹{item.sellingPrice}
                </Text>
              </View>
              <View style={[styles.qtyBadge, lowStock && styles.qtyBadgeLow]}>
                <Text style={[styles.qtyText, lowStock && styles.qtyTextLow]}>
                  {item.quantity}
                </Text>
              </View>
            </TouchableOpacity>
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  qtyBadge: {
    minWidth: 32,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
