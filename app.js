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
    const dx = cx - radius;
    const dy = cy - radius;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > radius) return;

    const pixel = ctx.getImageData(cx, cy, 1, 1).data;
    const [r, g, b] = pixel;

    indicator.style.left = `${x - 6}px`;
    indicator.style.top = `${y - 6}px`;
    indicator.style.display = 'block';

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
// BLE POŁĄCZENIE I WYSYŁANIE
// --------------------------------
async function connectToBLE() {
    if (!navigator.bluetooth) {
        alert("Twoja przeglądarka nie obsługuje Web Bluetooth.\nUżyj Chrome przez HTTPS lub localhost.");
        return;
    }

    try {
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'NeoPixel' }],
            optionalServices: ['12345678-1234-1234-1234-123456789abc']
        });
        const server = await bleDevice.gatt.connect();
        const service = await server.getPrimaryService('12345678-1234-1234-1234-123456789abc');
        bleCharacteristic = await service.getCharacteristic('0000abcd-0000-1000-8000-00805f9b34fb'); alert('Połączono z ESP32');
    } catch (e) {
        console.error('Błąd BLE:', e);
    }
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