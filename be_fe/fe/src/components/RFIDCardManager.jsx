import { useState, useEffect } from 'react';
import axios from '../api/axios';

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
            const response = await axios.get(`/rfid-cards/device/${deviceId}`);
            setCards(response.data.cards);
        } catch (error) {
            console.error('Failed to fetch cards:', error);
        }
    };

    const handleAddCard = async (e) => {
        e.preventDefault();
        if (!newCardUID || !newCardName) return;

        setLoading(true);
        try {
            await axios.post('/rfid-cards', {
                deviceId,
                cardUID: newCardUID.toUpperCase(),
                cardName: newCardName
            });
            setNewCardUID('');
            setNewCardName('');
            setShowAddForm(false);
            await fetchCards();
        } catch (error) {
            console.error('Failed to add card:', error);
            alert(error.response?.data?.message || 'Failed to add card');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCard = async (cardId) => {
        if (!confirm('Are you sure you want to delete this card?')) return;

        setLoading(true);
        try {
            await axios.delete(`/rfid-cards/${cardId}`);
            await fetchCards();
        } catch (error) {
            console.error('Failed to delete card:', error);
            alert('Failed to delete card');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleCard = async (cardId) => {
        setLoading(true);
        try {
            await axios.patch(`/rfid-cards/${cardId}/toggle`);
            await fetchCards();
        } catch (error) {
            console.error('Failed to toggle card:', error);
            alert('Failed to toggle card');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">🔑 RFID Cards</h3>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all"
                >
                    {showAddForm ? '✕ Cancel' : '+ Add Card'}
                </button>
            </div>

            {showAddForm && (
                <form onSubmit={handleAddCard} className="bg-white rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                            type="text"
                            placeholder="Card UID (e.g., B1:D7:7F:05)"
                            value={newCardUID}
                            onChange={(e) => setNewCardUID(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Card Name (e.g., John's Card)"
                            value={newCardName}
                            onChange={(e) => setNewCardName(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-3 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-bold transition-all"
                    >
                        {loading ? 'Adding...' : 'Add Card'}
                    </button>
                </form>
            )}

            {cards.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    <div className="text-4xl mb-2">🔑</div>
                    <p>No RFID cards registered</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {cards.map((card) => (
                        <div
                            key={card._id}
                            className={`flex items-center justify-between p-4 rounded-lg ${card.isActive ? 'bg-white border border-purple-200' : 'bg-gray-100 border border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`text-2xl ${card.isActive ? 'text-purple-600' : 'text-gray-400'}`}>
                                    {card.isActive ? '🔓' : '🔒'}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800">{card.cardName}</div>
                                    <div className="font-mono text-xs text-gray-500">{card.cardUID}</div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleToggleCard(card._id)}
                                    disabled={loading}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${card.isActive
                                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                        }`}
                                >
                                    {card.isActive ? 'Disable' : 'Enable'}
                                </button>
                                <button
                                    onClick={() => handleDeleteCard(card._id)}
                                    disabled={loading}
                                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RFIDCardManager;
