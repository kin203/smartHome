import { useState } from 'react';
import axios from '../api/axios';

const AddDeviceModal = ({ isOpen, onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('Light');
    const [room, setRoom] = useState('Phòng Khách');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await axios.post('/devices', { name, type, room });
            onAdd(response.data);
            setName('');
            setType('Light');
            setRoom('Phòng Khách');
            onClose();
        } catch (error) {
            console.error('Error adding device:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl transform transition-all">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Device</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Device Name
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                            placeholder="e.g., Living Room Light"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Device Type
                        </label>
                        <select
                            className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            <option value="Light">Light</option>
                            <option value="Fan">Fan</option>
                            <option value="Sensor">Sensor</option>
                            <option value="Switch">Switch</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                            Room
                        </label>
                        <select
                            className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                        >
                            <option value="Phòng Khách">Phòng Khách</option>
                            <option value="Phòng Ngủ">Phòng Ngủ</option>
                            <option value="Nhà Bếp">Nhà Bếp</option>
                            <option value="Khác">Khác</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-4 mt-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 transition-all"
                        >
                            {isLoading ? 'Adding...' : 'Add Device'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddDeviceModal;
