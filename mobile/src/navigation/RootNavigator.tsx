import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import TyreListScreen from "../screens/TyreListScreen";
import TyreFormScreen from "../screens/TyreFormScreen";

export type AppStackParamList = {
  TyreList: undefined;
  TyreForm: { tyreId?: string } | undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <AppStack.Navigator>
          <AppStack.Screen
            name="TyreList"
            component={TyreListScreen}
            options={{ title: "Tyre Inventory" }}
          />
          <AppStack.Screen
            name="TyreForm"
            component={TyreFormScreen}
            options={({ route }) => ({
              title: route.params?.tyreId ? "Edit Tyre" : "Add Tyre",
            })}
          />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
