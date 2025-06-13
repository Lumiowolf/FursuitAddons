const canvas = document.getElementById('palette');
const ctx = canvas.getContext('2d');
const indicator = document.getElementById('indicator');
const colorDisplay = document.getElementById('color-display');
const inputs = {
    r: document.getElementById('r'),
    g: document.getElementById('g'),
    b: document.getElementById('b'),
};

let mode = 'color'; // 'color' lub 'white'
let bleDevice = null;
let bleCharacteristic = null;
let disconnectChar = null;

let brightnessChar = null;

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

// --------------------------------
// RYSOWANIE PALETY
// --------------------------------
function drawPalette() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === 'color') {
        drawColorWheel();
    } else {
        drawWhiteTemperaturePalette();
    }
}

function drawColorWheel() {
    const radius = canvas.width / 2;
    const image = ctx.createImageData(canvas.width, canvas.height);

    for (let y = -radius; y < radius; y++) {
        for (let x = -radius; x < radius; x++) {
            const dx = x;
            const dy = y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const i = ((y + radius) * canvas.width + (x + radius)) * 4;

            if (distance <= radius) {
                const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
                const [cr, cg, cb] = hslToRgb(hue, 1, 0.5);
                const t = distance / radius;

                const r = Math.round(255 * (1 - t) + cr * t);
                const g = Math.round(255 * (1 - t) + cg * t);
                const b = Math.round(255 * (1 - t) + cb * t);

                image.data[i] = r;
                image.data[i + 1] = g;
                image.data[i + 2] = b;
                image.data[i + 3] = 255;
            }
        }
    }

    ctx.putImageData(image, 0, 0);
}

function drawWhiteTemperaturePalette() {
    const radius = canvas.width / 2;
    const image = ctx.createImageData(canvas.width, canvas.height);

    for (let y = -radius; y < radius; y++) {
        for (let x = -radius; x < radius; x++) {
            const dx = x;
            const dy = y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const i = ((y + radius) * canvas.width + (x + radius)) * 4;

            if (distance <= radius) {
                const t = (dx + radius) / (2 * radius);
                const temperature = 2000 + t * 8000;
                const [r, g, b] = colorTemperatureToRGB(temperature);

                image.data[i] = r;
                image.data[i + 1] = g;
                image.data[i + 2] = b;
                image.data[i + 3] = 255;
            }
        }
    }

    ctx.putImageData(image, 0, 0);
}

function hslToRgb(h, s, l) {
    h /= 360;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function colorTemperatureToRGB(kelvin) {
    let temp = kelvin / 100;
    let r, g, b;
    if (temp <= 66) {
        r = 255;
    } else {
        r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    }
    if (temp <= 66) {
        g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    } else {
        g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    }
    if (temp >= 66) {
        b = 255;
    } else if (temp <= 19) {
        b = 0;
    } else {
        b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    }

    return [
        Math.min(255, Math.max(0, Math.round(r))),
        Math.min(255, Math.max(0, Math.round(g))),
        Math.min(255, Math.max(0, Math.round(b))),
    ];
}

// --------------------------------
// INTERAKCJA
// --------------------------------
function updateColor(x, y) {
    const rect = canvas.getBoundingClientRect();
    const cx = x - rect.left;
    const cy = y - rect.top;

    const radius = canvas.width / 2;
    let dx = cx - radius;
    let dy = cy - radius;
    let distance = Math.sqrt(dx * dx + dy * dy);

    let drawX = cx;
    let drawY = cy;

    // jeśli poza kołem – ustaw wskaźnik na krawędzi
    if (distance > radius) {
        const angle = Math.atan2(dy, dx);
        drawX = radius + Math.cos(angle) * radius;
        drawY = radius + Math.sin(angle) * radius;
    }

    let pixel = ctx.getImageData(drawX, drawY, 1, 1).data;

    // jeśli przezroczysty – szukamy najbliższego koloru w stronę środka
    if (pixel[3] === 0) {
        const steps = 500; // dokładność
        for (let i = 1; i <= steps; i++) {
            const factor = 1 - i / steps;
            const tx = radius + dx * factor;
            const ty = radius + dy * factor;
            const tempPixel = ctx.getImageData(tx, ty, 1, 1).data;
            if (tempPixel[3] !== 0) {
                drawX = tx;
                drawY = ty;
                pixel = tempPixel;
                break;
            }
        }
    }

    const [r, g, b] = pixel;

    // przesunięcie wskaźnika
    indicator.style.left = `${drawX + rect.left - 6}px`;
    indicator.style.top = `${drawY + rect.top - 6}px`;
    indicator.style.display = 'block';

    // aktualizacja koloru
    colorDisplay.style.backgroundColor = `rgb(${r},${g},${b})`;
    inputs.r.value = r;
    inputs.g.value = g;
    inputs.b.value = b;

    sendColorToESP(r, g, b);
}

function setupInteraction() {
    function handleEvent(e) {
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        updateColor(x, y);
    }

    canvas.addEventListener('mousedown', () => {
        window.addEventListener('mousemove', handleEvent);
    });
    window.addEventListener('mouseup', () => {
        window.removeEventListener('mousemove', handleEvent);
    });

    canvas.addEventListener('touchstart', handleEvent);
    canvas.addEventListener('touchmove', handleEvent);
    canvas.addEventListener('click', handleEvent);
}

// --------------------------------
// RGB MANUAL INPUT
// --------------------------------
Object.values(inputs).forEach((input) => {
    input.addEventListener('input', () => {
        const r = parseInt(inputs.r.value || 0);
        const g = parseInt(inputs.g.value || 0);
        const b = parseInt(inputs.b.value || 0);
        colorDisplay.style.backgroundColor = `rgb(${r},${g},${b})`;
        indicator.style.display = 'none';
        sendColorToESP(r, g, b);
    });
});

// --------------------------------
// BRIGHTNESS CONTROL
// --------------------------------
async function sendBrightnessToESP(level) {
    if (!brightnessChar) return;
    try {
        await brightnessChar.writeValue(new Uint8Array([level]));
    } catch (e) {
        console.error('Błąd wysyłania jasności:', e);
    }
}

const brightnessInput = document.getElementById('brightness');

const sendBrightnessDebounced = debounce((value) => {
    sendBrightnessToESP(value);
}, 50); // wyślij po 100ms bez zmiany

brightnessInput.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    sendBrightnessDebounced(value);
});

// --------------------------------
// BLE POŁĄCZENIE I WYSYŁANIE
// --------------------------------
const bleDisconnectedHandler = () => {
    console.warn("BLE: Połączenie zakończone.");
    alert("Połączenie z ESP zostało zakończone.");
    bleDevice = null;
    bleCharacteristic = null;
    disconnectChar = null;
};

async function connectToBLE() {
    if (bleDevice && bleDevice.gatt.connected) {
        console.log("Zamykam poprzednie połączenie...");
        bleDevice.gatt.disconnect();
    }

    if (bleDevice) {
        // Usuń stary listener z poprzedniego urządzenia
        bleDevice.removeEventListener('gattserverdisconnected', bleDisconnectedHandler);
        bleDevice = null;
        bleCharacteristic = null;
        disconnectChar = null;
    }

    if (!navigator.bluetooth) {
        alert("Twoja przeglądarka nie obsługuje Web Bluetooth.\nUżyj Chrome przez HTTPS lub localhost.");
        return;
    }

    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'NeoPixel' }],
            optionalServices: ['12345678-1234-1234-1234-123456789abc']
        });

        bleDevice = device;
        bleDevice.addEventListener('gattserverdisconnected', bleDisconnectedHandler);

        const server = await bleDevice.gatt.connect();
        const service = await server.getPrimaryService('12345678-1234-1234-1234-123456789abc');
        bleCharacteristic = await service.getCharacteristic('0000abcd-0000-1000-8000-00805f9b34fb');
        disconnectChar = await service.getCharacteristic('0000dcba-0000-1000-8000-00805f9b34fb');
        brightnessChar = await service.getCharacteristic('0000bbaa-0000-1000-8000-00805f9b34fb');

        alert('Połączono z ESP32');
    } catch (e) {
        console.error('Błąd BLE:', e);
    }
}

async function disconnectBLE() {
    if (disconnectChar) {
        try {
            await disconnectChar.writeValue(new Uint8Array([1]));
            console.log("Poproszono ESP o rozłączenie");
        } catch (e) {
            console.error("Błąd przy wysyłaniu rozkazu rozłączenia:", e);
        }
    } else {
        console.warn("Brak charakterystyki rozłączenia — rozłączam siłowo");
        if (bleDevice && bleDevice.gatt.connected) {
            bleDevice.gatt.disconnect();
        }
    }

    bleDevice = null;
    bleCharacteristic = null;
    disconnectChar = null;
}

let bleBusy = false;

async function sendColorToESP(r, g, b) {
    if (!bleCharacteristic || bleBusy) return;

    try {
        bleBusy = true;
        const data = new Uint8Array([r, g, b]);
        await bleCharacteristic.writeValue(data);
    } catch (e) {
        console.error('Błąd wysyłania:', e);
    } finally {
        // odblokuj po krótkim czasie, by uniknąć zapętleń
        setTimeout(() => {
            bleBusy = false;
        }, 50); // 20–100 ms to dobry zakres przy BLE
    }
}

// --------------------------------
// TRYB PRZEŁĄCZNIKA
// --------------------------------
document.getElementById('switch-mode').addEventListener('click', () => {
    mode = mode === 'color' ? 'white' : 'color';
    document.getElementById('switch-mode').textContent =
        'Zmień tryb: ' + (mode === 'color' ? 'Kolorowy' : 'Biała temperatura');
    drawPalette();
});

// --------------------------------
// START
// --------------------------------
drawPalette();
setupInteraction();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').then(() => {
        console.log('Service Worker zarejestrowany');
    }).catch((err) => {
        console.error('Błąd Service Workera:', err);
    });
}