import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StatsScreen() {
    return (
        <SafeAreaView className="flex-1 bg-[#E6EFFD] items-center justify-center">
            <Text className="text-xl font-bold text-gray-800">Usage Stats</Text>
            <Text className="text-gray-500">Coming Soon</Text>
        </SafeAreaView>
    );
}
