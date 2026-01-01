import { Slot, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { AuthProvider, AuthContext } from '../src/context/AuthContext';
import { BackendStatusProvider } from '../src/context/BackendStatusContext';
import { useEffect, useContext } from 'react';
import { View, ActivityIndicator, LogBox } from 'react-native';
import '../global.css';

LogBox.ignoreLogs([
  'Cannot record touch end without a touch start',
  'Entypo has no exported member',
]);

const InitialLayout = () => {
  const { token, isLoading } = useContext(AuthContext);
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (isLoading || !navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [token, segments, isLoading, navigationState?.key]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-900">
        <Slot />
        <View className="absolute inset-0 justify-center items-center bg-gray-900">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    );
  }

  return <Slot />;
};

export default function RootLayout() {
  return (
    <BackendStatusProvider>
      <AuthProvider>
        <InitialLayout />
      </AuthProvider>
    </BackendStatusProvider>
  );
}
