import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AutomationScreen() {
    return (
        <SafeAreaView className="flex-1 bg-[#E6EFFD] items-center justify-center">
            <Text className="text-xl font-bold text-gray-800">Automation</Text>
            <Text className="text-gray-500">Coming Soon</Text>
        </SafeAreaView>
    );
}
