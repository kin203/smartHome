// Quick Debug Script - Chạy để test backend connection
const testBackend = async () => {
    const BASE_URL = 'http://192.168.100.29:5000';

    console.log('Testing Backend Connection...\n');

    // Test 1: Root endpoint
    try {
        const res = await fetch(`${BASE_URL}/`);
        const text = await res.text();
        console.log('✅ Root endpoint:', text);
    } catch (err) {
        console.log('❌ Root endpoint failed:', err.message);
    }

    // Test 2: Register new user
    try {
        const res = await fetch(`${BASE_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test User',
                email: 'test@example.com',
                password: '123456'
            })
        });
        const data = await res.json();
        console.log('✅ Register:', data);
    } catch (err) {
        console.log('❌ Register failed:', err.message);
    }

    // Test 3: Login
    try {
        const res = await fetch(`${BASE_URL}/api/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                password: '123456'
            })
        });
        const data = await res.json();
        console.log('✅ Login:', data.token ? 'Got token!' : data);

        // Test 4: Get devices with token
        if (data.token) {
            const devRes = await fetch(`${BASE_URL}/api/devices`, {
                headers: { 'Authorization': `Bearer ${data.token}` }
            });
            const devices = await devRes.json();
            console.log('✅ Devices:', devices.length, 'devices found');
        }
    } catch (err) {
        console.log('❌ Login failed:', err.message);
    }
};

testBackend();
