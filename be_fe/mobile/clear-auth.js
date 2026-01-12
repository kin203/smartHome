// Clear AsyncStorage Script - Reset mobile app authentication
import AsyncStorage from '@react-native-async-storage/async-storage';

const clearAuth = async () => {
  try {
    console.log('Clearing authentication data...');
    await AsyncStorage.removeItem('token');
    console.log('✅ Token cleared! Please restart the app.');
  } catch (error) {
    console.error('❌ Error clearing token:', error);
  }
};

clearAuth();
