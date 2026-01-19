/* BLE Provisioning Service for SmartHome ESP32
 * Mi Home-style device provisioning via Bluetooth Low Energy
 * 
 * Flow:
 * 1. ESP32 advertises as "SmartHome-XXXX" when not provisioned
 * 2. Mobile app scans and connects via BLE
 * 3. App sends WiFi credentials + Backend URL via BLE characteristics
 * 4. ESP32 saves config to Preferences
 * 5. ESP32 connects to WiFi
 * 6. ESP32 stops BLE, operates via WiFi
 */

#ifndef BLE_PROVISIONING_H
#define BLE_PROVISIONING_H

#include <NimBLEDevice.h>
#include <Preferences.h>

// Service and Characteristic UUIDs
#define SERVICE_UUID        "0000ff00-0000-1000-8000-00805f9b34fb"
#define CHAR_SSID_UUID      "0000ff01-0000-1000-8000-00805f9b34fb"
#define CHAR_PASSWORD_UUID  "0000ff02-0000-1000-8000-00805f9b34fb"
#define CHAR_BACKEND_UUID   "0000ff03-0000-1000-8000-00805f9b34fb"
#define CHAR_STATUS_UUID    "0000ff04-0000-1000-8000-00805f9b34fb"

class BLEProvisioningCallbacks : public NimBLECharacteristicCallbacks {
private:
    Preferences* prefs;
    char* ssid_buffer;
    char* pass_buffer;
    char* backend_buffer;
    bool* provision_received;
    
public:
    BLEProvisioningCallbacks(Preferences* p, char* s, char* pa, char* b, bool* pr) 
        : prefs(p), ssid_buffer(s), pass_buffer(pa), backend_buffer(b), provision_received(pr) {}
    
    void onWrite(NimBLECharacteristic* pCharacteristic) {
        std::string uuid = pCharacteristic->getUUID().toString();
        std::string value = pCharacteristic->getValue();
        
        Serial.printf("BLE Write to %s: %s\n", uuid.c_str(), value.c_str());
        
        if (uuid == CHAR_SSID_UUID) {
            strncpy(ssid_buffer, value.c_str(), 32);
            Serial.println("✓ SSID received");
        }
        else if (uuid == CHAR_PASSWORD_UUID) {
            strncpy(pass_buffer, value.c_str(), 64);
            Serial.println("✓ Password received");
        }
        else if (uuid == CHAR_BACKEND_UUID) {
            strncpy(backend_buffer, value.c_str(), 128);
            Serial.println("✓ Backend URL received");
            
            // All data received, save and trigger connection
            prefs->begin("smarthome", false);
            prefs->putString("wifi_ssid", ssid_buffer);
            prefs->putString("wifi_pass", pass_buffer);
            prefs->putString("backend_url", backend_buffer);
            prefs->putBool("provisioned", true);
            prefs->end();
            
            *provision_received = true;
            Serial.println("🎉 Provisioning complete! Saved to flash.");
        }
    }
};

class BLEProvisioning {
private:
    NimBLEServer* pServer;
    NimBLEService* pService;
    NimBLECharacteristic* pCharSSID;
    NimBLECharacteristic* pCharPassword;
    NimBLECharacteristic* pCharBackend;
    NimBLECharacteristic* pCharStatus;
    BLEProvisioningCallbacks* pCallbacks;
    
    char ssid_buffer[33] = {0};
    char pass_buffer[65] = {0};
    char backend_buffer[129] = {0};
    bool provision_received = false;
    
public:
    void init(Preferences* prefs, String deviceName) {
        Serial.println("🔵 Initializing BLE Provisioning...");
        
        NimBLEDevice::init(deviceName.c_str());
        NimBLEDevice::setPower(ESP_PWR_LVL_P9); // Max power for better range
        
        pServer = NimBLEDevice::createServer();
        pService = pServer->createService(SERVICE_UUID);
        
        // Create characteristics
        pCharSSID = pService->createCharacteristic(
            CHAR_SSID_UUID,
            NIMBLE_PROPERTY::WRITE
        );
        
        pCharPassword = pService->createCharacteristic(
            CHAR_PASSWORD_UUID,
            NIMBLE_PROPERTY::WRITE
        );
        
        pCharBackend = pService->createCharacteristic(
            CHAR_BACKEND_UUID,
            NIMBLE_PROPERTY::WRITE
        );
        
        pCharStatus = pService->createCharacteristic(
            CHAR_STATUS_UUID,
            NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
        );
        
        // Set callbacks
        pCallbacks = new BLEProvisioningCallbacks(
            prefs, ssid_buffer, pass_buffer, backend_buffer, &provision_received
        );
        
        pCharSSID->setCallbacks(pCallbacks);
        pCharPassword->setCallbacks(pCallbacks);
        pCharBackend->setCallbacks(pCallbacks);
        
        pCharStatus->setValue("Ready");
        
        pService->start();
        
        // Start advertising
        NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
        pAdvertising->addServiceUUID(SERVICE_UUID);
        pAdvertising->setScanResponse(true);
        pAdvertising->start();
        
        Serial.println("✅ BLE Advertising started: " + deviceName);
    }
    
    bool isProvisionReceived() {
        return provision_received;
    }
    
    void getCredentials(char* ssid, char* pass, char* backend) {
        strcpy(ssid, ssid_buffer);
        strcpy(pass, pass_buffer);
        strcpy(backend, backend_buffer);
    }
    
    void updateStatus(String status) {
        if (pCharStatus) {
            pCharStatus->setValue(status.c_str());
            pCharStatus->notify();
        }
    }
    
    void stop() {
        Serial.println("🔵 Stopping BLE...");
        if (pServer) {
            NimBLEDevice::getAdvertising()->stop();
            NimBLEDevice::deinit(true);
        }
    }
};

#endif
