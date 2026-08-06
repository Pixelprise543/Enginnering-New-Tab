// --- State Management & Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initWeather();
    initSearch();
    initTasks();
    initPomodoro();
    initNotes();
    initQuote();
    initShortcuts();
});

// --- Clock & Greeting ---
function initClock() {
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    const greetingEl = document.getElementById('greeting');

    function updateTime() {
        const now = new Date();
        
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        hours = hours % 12 || 12; 
        
        if (clockEl) {
            clockEl.textContent = `${hours}:${minutes}`;
        }

        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('en-US', options);
        }

        const currentHour = now.getHours();
        let greeting = 'Good Evening';
        if (currentHour >= 5 && currentHour < 12) greeting = 'Good Morning';
        else if (currentHour >= 12 && currentHour < 18) greeting = 'Good Afternoon';
        
        if (greetingEl) {
            greetingEl.textContent = `${greeting}, Engineer.`;
        }
    }
    
    updateTime();
    setInterval(updateTime, 1000);
}

// --- Weather ---
let weatherUnit = localStorage.getItem('weather_unit') || 'fahrenheit';
let weatherCity = localStorage.getItem('weather_city') || '';

function initWeather() {
    const weatherWidget = document.getElementById('weatherWidget');
    if (!weatherWidget) return;
    
    weatherWidget.addEventListener('click', () => {
        const choice = prompt(
            `Weather Settings:\nCurrent City: ${weatherCity || 'Auto-detect'}\nCurrent Unit: °${weatherUnit === 'fahrenheit' ? 'F' : 'C'}\n\nType a city name to change location, OR type 'unit' to toggle °F/°C, or leave blank to reset to auto location:`, 
            weatherCity
        );

        if (choice !== null) {
            const trimmed = choice.trim();
            if (trimmed.toLowerCase() === 'unit') {
                weatherUnit = weatherUnit === 'fahrenheit' ? 'celsius' : 'fahrenheit';
                localStorage.setItem('weather_unit', weatherUnit);
            } else if (trimmed === '') {
                weatherCity = '';
                localStorage.removeItem('weather_city');
            } else {
                weatherCity = trimmed;
                localStorage.setItem('weather_city', weatherCity);
            }
            fetchWeatherData();
        }
    });

    fetchWeatherData();
}

async function fetchWeatherData() {
    const tempEl = document.getElementById('weatherTemp');
    const cityEl = document.getElementById('weatherCity');
    const iconEl = document.getElementById('weatherIcon');
    
    if (tempEl) tempEl.textContent = '...';
    const unitSymbol = weatherUnit === 'fahrenheit' ? '°F' : '°C';

    try {
        let lat, lon, locationName = '';

        if (weatherCity) {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(weatherCity)}&count=1&language=en&format=json`);
            const geoData = await geoRes.json();
            if (geoData.results && geoData.results.length > 0) {
                lat = geoData.results[0].latitude;
                lon = geoData.results[0].longitude;
                locationName = geoData.results[0].name;
            } else {
                if (tempEl) tempEl.textContent = 'City not found';
                return;
            }
        } else {
            const pos = await new Promise((resolve) => {
                if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        resolve, 
                        () => resolve(null), 
                        { timeout: 3000 }
                    );
                } else {
                    resolve(null);
                }
            });

            if (pos && pos.coords) {
                lat = pos.coords.latitude;
                lon = pos.coords.longitude;
            } else {
                const ipRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
                const ipData = await ipRes.json();
                lat = parseFloat(ipData.latitude);
                lon = parseFloat(ipData.longitude);
                locationName = ipData.city || '';
            }
        }

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=${weatherUnit}`);
        const weatherData = await weatherRes.json();

        if (weatherData.current_weather) {
            const temp = Math.round(weatherData.current_weather.temperature);
            
            if (tempEl) tempEl.textContent = `${temp}${unitSymbol}`;
            if (cityEl) cityEl.textContent = locationName ? `• ${locationName}` : '';
            
            if (iconEl) {
                const code = weatherData.current_weather.weathercode;
                if (code === 0) iconEl.className = 'ph ph-sun';
                else if (code >= 1 && code <= 3) iconEl.className = 'ph ph-cloud-sun';
                else if (code >= 45 && code <= 48) iconEl.className = 'ph ph-cloud-fog';
                else if (code >= 51 && code <= 67) iconEl.className = 'ph ph-cloud-rain';
                else if (code >= 71 && code <= 77) iconEl.className = 'ph ph-snowflake';
                else if (code >= 80 && code <= 82) iconEl.className = 'ph ph-cloud-showers';
                else if (code >= 95) iconEl.className = 'ph ph-lightning';
                else iconEl.className = 'ph ph-thermometer';
            }
        }
    } catch (err) {
        if (tempEl) tempEl.textContent = 'Weather N/A';
        if (cityEl) cityEl.textContent = '';
    }
}

// --- Search Engine Logic ---
let currentEngine = 'google';
const engines = {
    google: 'https://www.google.com/search?q=',
    chatgpt: 'https://chatgpt.com/?q=',
    perplexity: 'https://www.perplexity.ai/search?q=',
    wolfram: 'https://www.wolframalpha.com/input/?i='
};

function initSearch() {
    const form = document.getElementById('searchForm');
    const input = document.getElementById('searchInput');
    const btns = document.querySelectorAll('.engine-btn');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentEngine = btn.dataset.engine;
            if (input) input.focus();
        });
    });

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (input) {
                const query = input.value.trim();
                if (query) {
                    window.location.href = engines[currentEngine] + encodeURIComponent(query);
                }
            }
        });
    }
}

// --- Task List (With Safe Parsing) ---
let tasks = [];
try {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
    // Force reset if the data is corrupted
    if (!Array.isArray(tasks)) throw new Error("Tasks corrupted");
} catch (e) {
    tasks = [
        { id: 1, text: 'Review Thermodynamics notes', done: false },
        { id: 2, text: 'Finish SolidWorks assembly', done: false },
        { id: 3, text: '', done: false } 
    ];
}

function initTasks() {
    renderTasks();
}

function renderTasks() {
    const list = document.getElementById('taskList');
    if (!list) return;
    list.innerHTML = '';
    
    if (tasks.length === 0 || tasks[tasks.length - 1].text.trim() !== '') {
        tasks.push({ id: Date.now(), text: '', done: false });
    }

    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = 'task-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.done;
        checkbox.addEventListener('change', () => {
            task.done = checkbox.checked;
            saveTasks();
        });

        const input = document.createElement('input');
        input.type = 'text';
        input.value = task.text;
        input.placeholder = index === tasks.length - 1 ? 'Add new task...' : '';
        
        input.addEventListener('input', (e) => {
            task.text = e.target.value;
            saveTasks();
        });
        
        input.addEventListener('blur', () => {
            tasks = tasks.filter((t, i) => t.text.trim() !== '' || i === tasks.length - 1);
            saveTasks();
            renderTasks();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (task.text.trim() !== '' && index === tasks.length - 1) {
                     tasks.push({ id: Date.now(), text: '', done: false });
                     saveTasks();
                     renderTasks();
                     setTimeout(() => {
                         const inputs = list.querySelectorAll('input[type="text"]');
                         if (inputs.length > 0) inputs[inputs.length - 1].focus();
                     }, 10);
                }
            }
        });

        li.appendChild(checkbox);
        li.appendChild(input);
        list.appendChild(li);
    });
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// --- Customizable Focus Timer ---
let timerInterval;
let customMinutes = parseInt(localStorage.getItem('timer_minutes')) || 25;
// Ensure we don't accidentally get NaN if localStorage is corrupted
if (isNaN(customMinutes)) customMinutes = 25; 

let totalTime = customMinutes * 60;
let timeLeft = totalTime;
let isRunning = false;

function initPomodoro() {
    const startBtn = document.getElementById('startTimerBtn');
    const resetBtn = document.getElementById('resetTimerBtn');
    const timerText = document.getElementById('timerText');
    const presetBtns = document.querySelectorAll('.preset-btn');

    presetBtns.forEach(btn => {
        const mins = parseInt(btn.dataset.time);
        if (mins === customMinutes) {
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setTimerDuration(mins);
        });
    });

    if (timerText) {
        timerText.addEventListener('click', () => {
            if (isRunning) return;
            const userMins = prompt('Enter timer duration in minutes (1 - 180):', customMinutes);
            if (userMins !== null) {
                const parsed = parseInt(userMins.trim());
                if (!isNaN(parsed) && parsed > 0 && parsed <= 180) {
                    presetBtns.forEach(b => {
                        b.classList.toggle('active', parseInt(b.dataset.time) === parsed);
                    });
                    setTimerDuration(parsed);
                }
            }
        });
    }

    updateTimerDisplay();

    // Wire up the buttons!
    if (startBtn) startBtn.addEventListener('click', toggleTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);
}

function setTimerDuration(mins) {
    if (isRunning) toggleTimer();
    customMinutes = mins;
    localStorage.setItem('timer_minutes', customMinutes);
    totalTime = customMinutes * 60;
    timeLeft = totalTime;
    updateTimerDisplay();
}

function toggleTimer() {
    const startBtn = document.getElementById('startTimerBtn');
    if (isRunning) {
        clearInterval(timerInterval);
        if (startBtn) {
            startBtn.innerHTML = '<i class="ph ph-play"></i> Start';
            startBtn.classList.add('btn-primary');
        }
    } else {
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                isRunning = false;
                if (startBtn) {
                    startBtn.innerHTML = '<i class="ph ph-play"></i> Start';
                    startBtn.classList.add('btn-primary');
                }
            }
        }, 1000);
        if (startBtn) {
            startBtn.innerHTML = '<i class="ph ph-pause"></i> Pause';
            startBtn.classList.remove('btn-primary');
        }
    }
    isRunning = !isRunning;
}

function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    timeLeft = totalTime;
    updateTimerDisplay();
    const startBtn = document.getElementById('startTimerBtn');
    if (startBtn) {
        startBtn.innerHTML = '<i class="ph ph-play"></i> Start';
        startBtn.classList.add('btn-primary');
    }
}

function updateTimerDisplay() {
    const text = document.getElementById('timerText');
    const display = document.getElementById('timerDisplay');
    
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    if (text) {
        text.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    const percentage = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
    if (display) {
        display.style.setProperty('--progress', `${percentage}%`);
    }
}

// --- Notes Autosave ---
function initNotes() {
    const notesArea = document.getElementById('notesArea');
    if (!notesArea) return;
    
    notesArea.value = localStorage.getItem('engineering_notes') || '';
    
    notesArea.addEventListener('input', (e) => {
        localStorage.setItem('engineering_notes', e.target.value);
    });
}

// --- Rotating Quotes ---
function initQuote() {
    const quotes = [
        { text: "Engineering is the closest thing to magic that exists in the world.", author: "Elon Musk" },
        { text: "The best design is the simplest one that works.", author: "Albert Einstein" },
        { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
        { text: "Strive for perfection in everything you do. Take the best that exists and make it better.", author: "Sir Henry Royce" }
    ];
    
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const selectedQuote = quotes[dayOfYear % quotes.length];
    
    const quoteText = document.getElementById('quoteText');
    const quoteAuthor = document.getElementById('quoteAuthor');
    
    if (quoteText) {
        quoteText.textContent = `"${selectedQuote.text}"`;
    }
    if (quoteAuthor) {
        quoteAuthor.textContent = `— ${selectedQuote.author}`;
    }
}

// --- Global Keyboard Shortcuts ---
function initShortcuts() {
    document.addEventListener('keydown', (e) => {
        const activeNode = document.activeElement;
        const isInputFocused = activeNode && ['INPUT', 'TEXTAREA'].includes(activeNode.tagName);
        
        if (e.key === '/' && !isInputFocused) {
            e.preventDefault();
            const input = document.getElementById('searchInput');
            if (input) input.focus();
        }
        if (e.key.toLowerCase() === 'n' && !isInputFocused) {
            e.preventDefault();
            const area = document.getElementById('notesArea');
            if (area) area.focus();
        }
        if (e.key === ' ' && !isInputFocused) {
            e.preventDefault();
            toggleTimer();
        }
    });
}