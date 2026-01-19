/**
 * BLE Provisioning Service for SmartHome
 * Mi Home-style device provisioning via React Native BLE Manager
 */

import BleManager from 'react-native-ble-manager';
import { NativeModules, NativeEventEmitter, PermissionsAndroid, Platform } from 'react-native';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

// Service and Characteristic UUIDs (match ESP32)
const SERVICE_UUID = '0000FF00-0000-1000-8000-00805F9B34FB';
const CHAR_SSID_UUID = '0000FF01-0000-1000-8000-00805F9B34FB';
const CHAR_PASSWORD_UUID = '0000FF02-0000-1000-8000-00805F9B34FB';
const CHAR_BACKEND_UUID = '0000FF03-0000-1000-8000-00805F9B34FB';
const CHAR_STATUS_UUID = '0000FF04-0000-1000-8000-00805F9B34FB';

export interface BLEDevice {
    id: string;
    name: string;
    rssi: number;
}

class BLEProvisioningService {
    private isScanning = false;
    private connectedDeviceId: string | null = null;

    async initialize() {
        try {
            await BleManager.start({ showAlert: false });
            console.log('✅ BLE Manager initialized');

            // Request permissions on Android
            if (Platform.OS === 'android' && Platform.Version >= 31) {
                await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ]);
            } else if (Platform.OS === 'android') {
                await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                );
            }
        } catch (error) {
            console.error('❌ BLE initialization error:', error);
            throw error;
        }
    }

    async startScan(onDeviceFound: (device: BLEDevice) => void): Promise<void> {
        if (this.isScanning) {
            console.warn('Scan already in progress');
            return;
        }

        this.isScanning = true;
        const devices = new Map<string, BLEDevice>();

        const handleDiscoverPeripheral = (peripheral: any) => {
            if (peripheral.name && peripheral.name.startsWith('SmartHome-')) {
                const device: BLEDevice = {
                    id: peripheral.id,
                    name: peripheral.name,
                    rssi: peripheral.rssi,
                };

                if (!devices.has(device.id)) {
                    devices.set(device.id, device);
                    onDeviceFound(device);
                    console.log(`📱 Found device: ${device.name} (${device.rssi} dBm)`);
                }
            }
        };

        bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral);

        try {
            await BleManager.scan([], 10, true); // Scan for 10 seconds
            console.log('🔍 Scanning for SmartHome devices...');

            setTimeout(() => {
                this.stopScan();
                bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral');
            }, 10000);
        } catch (error) {
            console.error('❌ Scan error:', error);
            this.isScanning = false;
            bleManagerEmitter.removeAllListeners('BleManagerDiscoverPeripheral');
            throw error;
        }
    }

    async stopScan() {
        if (this.isScanning) {
            await BleManager.stopScan();
            this.isScanning = false;
            console.log('⏹️ Scan stopped');
        }
    }

    async connectDevice(deviceId: string): Promise<void> {
        try {
            console.log(`🔌 Connecting to ${deviceId}...`);
            await BleManager.connect(deviceId);
            this.connectedDeviceId = deviceId;

            // Retrieve services
            await BleManager.retrieveServices(deviceId);
            console.log('✅ Connected and services retrieved');
        } catch (error) {
            console.error('❌ Connection error:', error);
            throw error;
        }
    }

    async sendCredentials(
        ssid: string,
        password: string,
        backendUrl: string
    ): Promise<void> {
        if (!this.connectedDeviceId) {
            throw new Error('No device connected');
        }

        try {
            // Send SSID
            console.log(`📤 Sending SSID: ${ssid}`);
            await this.writeCharacteristic(CHAR_SSID_UUID, ssid);
            await new Promise(resolve => setTimeout(resolve, 200));

            // Send Password
            console.log(`📤 Sending Password`);
            await this.writeCharacteristic(CHAR_PASSWORD_UUID, password);
            await new Promise(resolve => setTimeout(resolve, 200));

            // Send Backend URL (triggers save on ESP32)
            console.log(`📤 Sending Backend URL: ${backendUrl}`);
            await this.writeCharacteristic(CHAR_BACKEND_UUID, backendUrl);

            console.log('✅ Credentials sent successfully');
        } catch (error) {
            console.error('❌ Error sending credentials:', error);
            throw error;
        }
    }

    private async writeCharacteristic(characteristicUUID: string, value: string): Promise<void> {
        if (!this.connectedDeviceId) {
            throw new Error('No device connected');
        }

        const data = Array.from(value).map(char => char.charCodeAt(0));

        await BleManager.write(
            this.connectedDeviceId,
            SERVICE_UUID,
            characteristicUUID,
            data
        );
    }

    async disconnect(): Promise<void> {
        if (this.connectedDeviceId) {
            try {
                await BleManager.disconnect(this.connectedDeviceId);
                console.log('🔌 Disconnected');
                this.connectedDeviceId = null;
            } catch (error) {
                console.error('❌ Disconnect error:', error);
            }
        }
    }

    async readStatus(): Promise<string> {
        if (!this.connectedDeviceId) {
            throw new Error('No device connected');
        }

        try {
            const data = await BleManager.read(
                this.connectedDeviceId,
                SERVICE_UUID,
                CHAR_STATUS_UUID
            );

            return String.fromCharCode(...data);
        } catch (error) {
            console.error('❌ Error reading status:', error);
            throw error;
        }
    }
}

export default new BLEProvisioningService();
