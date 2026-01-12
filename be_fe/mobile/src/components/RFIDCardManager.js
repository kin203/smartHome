import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Lock, Unlock, Trash2, Plus, X } from 'lucide-react-native';
import client from '../api/client';

const RFIDCardManager = ({ deviceId }) => {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newCardUID, setNewCardUID] = useState('');
    const [newCardName, setNewCardName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        if (deviceId) {
            fetchCards();
        }
    }, [deviceId]);

    const fetchCards = async () => {
        try {
            const response = await client.get(`/rfid-cards/device/${deviceId}`);
            setCards(response.data.cards);
        } catch (error) {
            console.error('Failed to fetch cards:', error);
        }
    };

    const handleAddCard = async () => {
        if (!newCardUID || !newCardName) {
            Alert.alert('Error', 'Please enter both UID and Name');
            return;
        }

        setLoading(true);
        try {
            await client.post('/rfid-cards', {
                deviceId,
                cardUID: newCardUID.toUpperCase(),
                cardName: newCardName
            });
            setNewCardUID('');
            setNewCardName('');
            setShowAddForm(false);
            await fetchCards();
            Alert.alert('Success', 'Card added successfully');
        } catch (error) {
            console.error('Failed to add card:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to add card');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCard = (cardId) => {
        Alert.alert('Delete Card', 'Are you sure you want to delete this card?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setLoading(true);
                    try {
                        await client.delete(`/rfid-cards/${cardId}`);
                        await fetchCards();
                    } catch (error) {
                        console.error('Failed to delete card:', error);
                        Alert.alert('Error', 'Failed to delete card');
                    } finally {
                        setLoading(false);
                    }
                }
            }
        ]);
    };

    const handleToggleCard = async (cardId) => {
        setLoading(true);
        try {
            await client.patch(`/rfid-cards/${cardId}/toggle`);
            await fetchCards();
        } catch (error) {
            console.error('Failed to toggle card:', error);
            Alert.alert('Error', 'Failed to toggle card');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="bg-purple-50 rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-gray-800">🔑 RFID Cards</Text>
                <TouchableOpacity
                    onPress={() => setShowAddForm(!showAddForm)}
                    className="bg-purple-600 px-3 py-2 rounded-lg flex-row items-center gap-1"
                >
                    {showAddForm ? <X size={16} color="white" /> : <Plus size={16} color="white" />}
                    <Text className="text-white font-bold text-xs">
                        {showAddForm ? 'Cancel' : 'Add Card'}
                    </Text>
                </TouchableOpacity>
            </View>

            {showAddForm && (
                <View className="bg-white rounded-lg p-4 mb-4 border border-purple-100 shadow-sm">
                    <TextInput
                        placeholder="Card UID (e.g., B1:D7:7F:05)"
                        value={newCardUID}
                        onChangeText={setNewCardUID}
                        className="bg-gray-50 px-3 py-2 border border-gray-200 rounded-lg mb-3 text-sm"
                        autoCapitalize="characters"
                    />
                    <TextInput
                        placeholder="Card Name (e.g., John's Card)"
                        value={newCardName}
                        onChangeText={setNewCardName}
                        className="bg-gray-50 px-3 py-2 border border-gray-200 rounded-lg mb-3 text-sm"
                    />
                    <TouchableOpacity
                        onPress={handleAddCard}
                        disabled={loading}
                        className="bg-green-600 py-2 rounded-lg items-center"
                    >
                        {loading ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <Text className="text-white font-bold text-sm">Save Card</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {cards.length === 0 ? (
                <View className="items-center py-6">
                    <Text className="text-4xl mb-2">🔑</Text>
                    <Text className="text-gray-500">No RFID cards registered</Text>
                </View>
            ) : (
                <ScrollView className="max-h-80">
                    {cards.map((card) => (
                        <View
                            key={card._id}
                            className={`flex-row items-center justify-between p-3 rounded-lg mb-2 border ${card.isActive ? 'bg-white border-purple-200' : 'bg-gray-100 border-gray-300'
                                }`}
                        >
                            <View className="flex-row items-center gap-3 flex-1">
                                {card.isActive ? (
                                    <Unlock size={20} color="#9333EA" />
                                ) : (
                                    <Lock size={20} color="#9CA3AF" />
                                )}
                                <View>
                                    <Text className="font-bold text-gray-800 text-sm">{card.cardName}</Text>
                                    <Text className="font-mono text-xs text-gray-500">{card.cardUID}</Text>
                                </View>
                            </View>
                            <View className="flex-row gap-2">
                                <TouchableOpacity
                                    onPress={() => handleToggleCard(card._id)}
                                    disabled={loading}
                                    className={`px-3 py-1.5 rounded-lg ${card.isActive ? 'bg-yellow-500' : 'bg-green-500'}`}
                                >
                                    <Text className="text-white text-xs font-bold">
                                        {card.isActive ? 'Disable' : 'Enable'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDeleteCard(card._id)}
                                    disabled={loading}
                                    className="bg-red-500 px-2 py-1.5 rounded-lg justify-center"
                                >
                                    <Trash2 size={16} color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

export default RFIDCardManager;
