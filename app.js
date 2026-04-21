function getGeminiUrl(key, model = 'gemini-2.0-flash-exp') {
    // Upgraded to Gemini 2.0 Flash-Exp for better performance and availability
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
}

// === STATE MANAGEMENT ===
let state = {
    meals: JSON.parse(localStorage.getItem('mt_meals')) || [],
    recipes: JSON.parse(localStorage.getItem('mt_recipes')) || [],
    weights: JSON.parse(localStorage.getItem('mt_weights')) || [],
    profile: JSON.parse(localStorage.getItem('mt_profile')) || null,
    workouts: JSON.parse(localStorage.getItem('mt_workouts')) || [],
    apiKey: localStorage.getItem('mt_api_key') || null,
    apiKeyModel: localStorage.getItem('mt_api_model') || 'gemini-2.0-flash-exp',
    recentMeals: JSON.parse(localStorage.getItem('mt_recent')) || []
};

let MACRO_GOALS = {
    calories: 2500,
    protein: 160,
    carbs: 250,
    fat: 70
};

// Sync dynamic goals if profile exists
if (state.profile) {
    MACRO_GOALS = state.profile.macros;
}

function saveState() {
    localStorage.setItem('mt_meals', JSON.stringify(state.meals));
    localStorage.setItem('mt_recipes', JSON.stringify(state.recipes));
    localStorage.setItem('mt_weights', JSON.stringify(state.weights));
    localStorage.setItem('mt_profile', JSON.stringify(state.profile));
    localStorage.setItem('mt_workouts', JSON.stringify(state.workouts));
    localStorage.setItem('mt_api_key', state.apiKey || '');
    localStorage.setItem('mt_api_model', state.apiKeyModel || 'gemini-2.0-flash-exp');
    localStorage.setItem('mt_recent', JSON.stringify(state.recentMeals));
    
    if (state.profile) MACRO_GOALS = state.profile.macros;
    
    renderDashboard();
    renderWeights();
    renderRecipes();
    renderProfile();
    renderWorkouts();
    renderRecentMeals();
}

// === CONSTANTS & DOM ELEMENTS ===
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const currentDateEl = document.getElementById('current-date');

// Navigation Logic
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class from all
        navItems.forEach(nav => nav.classList.remove('active'));
        views.forEach(view => view.classList.remove('active-view', 'hidden-view'));
        
        // Add active class to clicked
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        
        views.forEach(view => {
            if (view.id === targetId) {
                view.classList.add('active-view');
            } else {
                view.classList.add('hidden-view');
            }
        });

        // Special handlers
        if (targetId === 'view-scanner') {
            startCamera();
        }

        if (targetId === 'view-progress') {
            renderWeightChart();
            renderWorkouts();
        }
    });
});

// === DATE MANAGEMENT & DIARY ===
let displayDateOffset = 0;

function getDisplayDate() {
    const d = new Date();
    d.setDate(d.getDate() + displayDateOffset);
    return d;
}

function updateDateHeader() {
    const d = getDisplayDate();
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    let text = "";
    if (displayDateOffset === 0) {
        text = 'Today';
    } else if (displayDateOffset === -1) {
        text = 'Yesterday';
    } else {
        text = d.toLocaleDateString('en-US', options);
    }
    currentDateEl.innerText = text;
    
    // Sync Scanner Date Subtitle loosely
    const scanDateTarget = document.getElementById('scan-target-date');
    if (scanDateTarget) {
        scanDateTarget.innerText = "Logging into: " + text;
    }
}

document.getElementById('prev-date').addEventListener('click', () => { displayDateOffset--; updateDateHeader(); renderDashboard(); });
document.getElementById('next-date').addEventListener('click', () => { displayDateOffset++; updateDateHeader(); renderDashboard(); });

function isSameDate(timestamp) {
    const d1 = getDisplayDate();
    const d2 = new Date(timestamp);
    return d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear();
}

updateDateHeader(); // initialize on load


window.toggleAccordion = function(id) {
    const el = document.getElementById(id);
    const header = document.getElementById('header-' + id);
    if (!el || !header) return;
    el.classList.toggle('collapsed');
    header.classList.toggle('collapsed');
};

// === DASHBOARD RENDER ===
function renderDashboard() {
    const todaysMeals = state.meals.filter(m => isSameDate(m.timestamp));
    
    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    let mealsHTML = '';

    const categories = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
    categories.forEach(cat => {
        const catMeals = todaysMeals.filter(m => {
            if (cat === 'other') return !m.type || m.type === 'other';
            return m.type === cat;
        });

        if (catMeals.length > 0) {
            let catCal = 0, catPro = 0, catCar = 0, catFat = 0;
            let itemsHTML = '';
            
            catMeals.forEach(meal => {
                catCal += meal.calories; catPro += meal.protein; catCar += meal.carbs; catFat += meal.fat;
                totals.calories += meal.calories;
                totals.protein += meal.protein;
                totals.carbs += meal.carbs;
                totals.fat += meal.fat;

                itemsHTML += `
                    <div class="list-item" style="background:rgba(0,0,0,0.2); margin-top:8px; border-radius:var(--border-radius-sm);">
                        <div style="flex:1;">
                            <div class="list-item-title">${meal.name}</div>
                            <div class="list-item-sub">${meal.protein}g P • ${meal.carbs}g C • ${meal.fat}g F</div>
                        </div>
                        <div class="list-item-val" style="display:flex; align-items:center; gap:12px;">
                            <span>${meal.calories} kcal</span>
                            <button class="btn btn-secondary" onclick="deleteMeal('${meal.id}')" style="padding: 6px; color:#ff3366; border:1px solid rgba(255,51,102,0.2);"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });

            mealsHTML += `
                <div class="card form-card" style="margin-bottom:16px;">
                    <div id="header-cat-${cat}" class="accordion-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:8px; cursor:pointer;" onclick="toggleAccordion('cat-${cat}')">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-chevron-down" style="color:var(--text-secondary); font-size:12px;"></i>
                            <h4 style="text-transform:uppercase; color:var(--accent-blue); letter-spacing:1px; font-size:14px;">${cat}</h4>
                        </div>
                        <span style="font-weight:bold; color:white;">${catCal} kcal</span>
                    </div>
                    <div id="cat-${cat}" class="accordion-content">
                        ${itemsHTML}
                    </div>
                </div>
            `;
        }
    });

    if (todaysMeals.length === 0) {
        mealsHTML = `<div class="empty-state">No meals tracked today yet.</div>`;
    }
    document.getElementById('diary-sections').innerHTML = mealsHTML;

    // Update Totals
    document.getElementById('cal-val').innerText = totals.calories;
    document.getElementById('pro-val').innerText = totals.protein;
    document.getElementById('carb-val').innerText = totals.carbs;
    document.getElementById('fat-val').innerText = totals.fat;

    // Update Goals Display in UI
    document.getElementById('cal-goal').innerText = MACRO_GOALS.calories;
    document.getElementById('pro-goal').innerText = MACRO_GOALS.protein;
    document.getElementById('carb-goal').innerText = MACRO_GOALS.carbs;
    document.getElementById('fat-goal').innerText = MACRO_GOALS.fat;

    // Update Circle Progress (250 is the stroke-dasharray max)
    const calPerc = Math.min(totals.calories / MACRO_GOALS.calories, 1);
    const dashOffset = 250 - (250 * calPerc);
    document.getElementById('cal-progress').style.strokeDashoffset = dashOffset;

    // Update Bars
    const proPerc = Math.min((totals.protein / MACRO_GOALS.protein) * 100, 100);
    const carbPerc = Math.min((totals.carbs / MACRO_GOALS.carbs) * 100, 100);
    const fatPerc = Math.min((totals.fat / MACRO_GOALS.fat) * 100, 100);
    
    document.getElementById('pro-bar').style.width = `${proPerc}%`;
    document.getElementById('carb-bar').style.width = `${carbPerc}%`;
    document.getElementById('fat-bar').style.width = `${fatPerc}%`;
}


// === CAMERA & AI SCANNER ===
let stream = null;
const videoEl = document.getElementById('camera-feed');
const canvasEl = document.getElementById('camera-canvas');
const captureBtn = document.getElementById('capture-btn');
const loadingEl = document.getElementById('ai-loading');
const resultEl = document.getElementById('ai-result');

let scannedMealTemp = null;

async function startCamera() {
    // If stream exists and is still active, just re-attach and play
    if (stream && stream.active) {
        if (videoEl.srcObject !== stream) {
            videoEl.srcObject = stream;
        }
        videoEl.play().catch(e => console.warn("Auto-play prevented", e));
        return;
    }
    
    try {
        // Request access (browser should remember this on HTTPS)
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        videoEl.srcObject = stream;
        videoEl.play();
    } catch (err) {
        console.error("Error accessing camera:", err);
        console.warn("Camera access denied or unavailable. Manual entry recommended.");
    }
}

// === SCANNER TABS & MODES ===
let currentScannerMode = 'meal'; // or 'label'
const tabCamBtn = document.getElementById('tab-cam-btn');
const tabLabelBtn = document.getElementById('tab-label-btn');
const tabManBtn = document.getElementById('tab-man-btn');

function resetScannerTabs() {
    tabCamBtn.classList.replace('btn-primary', 'btn-secondary');
    tabLabelBtn.classList.replace('btn-primary', 'btn-secondary');
    tabManBtn.classList.replace('btn-primary', 'btn-secondary');
}

tabCamBtn.addEventListener('click', () => {
    resetScannerTabs();
    tabCamBtn.classList.replace('btn-secondary', 'btn-primary');
    currentScannerMode = 'meal';
    document.getElementById('scanner-cam-view').classList.remove('hidden');
    document.getElementById('scanner-man-view').classList.add('hidden');
    startCamera();
});

tabLabelBtn.addEventListener('click', () => {
    resetScannerTabs();
    tabLabelBtn.classList.replace('btn-secondary', 'btn-primary');
    currentScannerMode = 'label';
    document.getElementById('scanner-cam-view').classList.remove('hidden');
    document.getElementById('scanner-man-view').classList.add('hidden');
    startCamera();
});

tabManBtn.addEventListener('click', () => {
    resetScannerTabs();
    tabManBtn.classList.replace('btn-secondary', 'btn-primary');
    document.getElementById('scanner-cam-view').classList.add('hidden');
    document.getElementById('scanner-man-view').classList.remove('hidden');
    stopCamera();
});

function stopCamera() {
    // Soft stop: We keep the tracks alive in the 'stream' variable 
    // so we don't have to ask for permission again.
    // We just detach the video element to stop the UI rendering.
    if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
    }
}

// Full Shutdown (on logout or page close if needed)
function hardStopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

async function runAIVisionScan(base64Data) {
    // UI Updates
    document.getElementById('capture-btn').classList.add('hidden');
    document.getElementById('take-photo-btn').classList.add('hidden');
    resultEl.classList.add('hidden');
    loadingEl.classList.remove('hidden');

    let promptText = `Analyze this image and estimate the food. Return ONLY a valid JSON object with:
        "name" (string), 
        "calories" (number), "protein" (number), "carbs" (number), "fat" (number),
        "confidence" (number, 0-100),
        "breakdown" (array of objects with "item", "calories", "protein", "carbs", and "fat" keys showing major ingredients found).
        STRICTLY ONLY JSON.`;
    
    if (currentScannerMode === 'label') {
        promptText = "Analyze this image. If it is a Barcode, read the absolute numerical UPCA digits perfectly and return ONLY JSON like `{\"barcode\": \"1234567890\"}`. If it is a Nutrition Label WITHOUT a barcode, return exactly the parsed macros like `{\"name\": \"Scanned Item\", \"calories\": 100, \"protein\": 10, \"carbs\": 10, \"fat\": 10, \"confidence\": 100, \"breakdown\": []}`. STRICTLY ONLY JSON.";
    }

    if (!state.apiKey) {
        alert("Please go to the Profile tab and enter a Google AI API Key.");
        document.querySelector('.nav-item[data-target="view-profile"]').click();
        captureBtn.classList.remove('hidden');
        loadingEl.classList.add('hidden');
        return;
    }

    try {
        const payload = { contents: [{ parts: [{ text: promptText }, { inline_data: { mime_type: "image/jpeg", data: base64Data } }] }] };

        const res = await fetch(getGeminiUrl(state.apiKey, state.apiKeyModel), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(`Google API Error ${res.status}: ${errData.error?.message || "Check your API key."}`);
        }

        const data = await res.json();
        let textResult = data.candidates[0].content.parts[0].text;
        const match = textResult.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("Could not find JSON in AI response.");
        
        let mealData = JSON.parse(match[0]);
        if (mealData.barcode) {
            loadingEl.querySelector('p').innerText = "Found barcode... Fetching OpenFoodFacts DB...";
            mealData = await lookupBarcodeOpenFoodFacts(mealData.barcode);
        }

        scannedMealTemp = {
            id: Date.now().toString(),
            name: mealData.name || "Unknown Meal",
            calories: mealData.calories || 0,
            protein: mealData.protein || 0,
            carbs: mealData.carbs || 0,
            fat: mealData.fat || 0,
            confidence: mealData.confidence || 0,
            breakdown: mealData.breakdown || [],
            timestamp: getDisplayDate().getTime()
        };

        // Populate UI
        document.getElementById('ai-meal-name').innerText = scannedMealTemp.name;
        document.getElementById('res-cal').innerText = scannedMealTemp.calories;
        document.getElementById('res-pro').innerText = scannedMealTemp.protein;
        document.getElementById('res-car').innerText = scannedMealTemp.carbs;
        document.getElementById('res-fat').innerText = scannedMealTemp.fat;
        document.getElementById('ai-confidence').innerText = `${scannedMealTemp.confidence}% Confidence`;
        
        const breakdownList = document.getElementById('ai-breakdown-list');
        breakdownList.innerHTML = '';
        if (scannedMealTemp.breakdown && scannedMealTemp.breakdown.length > 0) {
            scannedMealTemp.breakdown.forEach(item => {
                const li = document.createElement('li');
                li.style = "margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.05);";
                li.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                        <span style="color:white; font-size:14px; font-weight:bold;">${item.item}</span>
                        <span style="color:var(--accent-blue); font-weight:bold;">${item.calories} kcal</span>
                    </div>
                    <div style="display:flex; gap:10px; font-size:11px; color:var(--text-secondary);">
                        <span>P: <b style="color:var(--color-protein);">${item.protein || 0}g</b></span>
                        <span>C: <b style="color:var(--color-carbs);">${item.carbs || 0}g</b></span>
                        <span>F: <b style="color:var(--color-fat);">${item.fat || 0}g</b></span>
                    </div>
                `;
                breakdownList.appendChild(li);
            });
            document.getElementById('ai-breakdown-container').classList.remove('hidden');
        }

        // SHOW RESULTS - This was missing!
        resultEl.classList.remove('hidden');
        if (typeof renderRecentMeals === 'function') renderRecentMeals();

    } catch (err) {
        console.error("Scan Error:", err);
        alert(`Scanner Error: ${err.message}`);
        captureBtn.classList.remove('hidden');
        document.getElementById('take-photo-btn').classList.remove('hidden');
    } finally {
        loadingEl.classList.add('hidden');
        document.getElementById('snap-preview').classList.add('hidden');
    }
}

// LIVE SCAN: Rapid capture
captureBtn.addEventListener('click', async () => {
    if (!stream) return;
    const ctx = canvasEl.getContext('2d');
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    await runAIVisionScan(canvasEl.toDataURL('image/jpeg', 0.8).split(',')[1]);
});

// TAKE PHOTO: Freeze frame + Flash capture
const takePhotoBtn = document.getElementById('take-photo-btn');
if (takePhotoBtn) {
    takePhotoBtn.addEventListener('click', async () => {
        if (!stream) return;

        // 1. Capture the image
        const ctx = canvasEl.getContext('2d');
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        const dataUrl = canvasEl.toDataURL('image/jpeg', 0.8);
        
        // 2. Freeze the UI
        const preview = document.getElementById('snap-preview');
        preview.src = dataUrl;
        preview.classList.remove('hidden');
        
        // 3. Flash effect
        const flash = document.getElementById('camera-flash');
        flash.classList.remove('flash-active');
        void flash.offsetWidth; // trigger reflow
        flash.classList.add('flash-active');

        // 4. Run Scan
        await runAIVisionScan(dataUrl.split(',')[1]);
    });
}

// Photo Picker Listeners
const mediaInput = document.getElementById('media-input');
if (mediaInput) {
    const nativeSnapBtn = document.getElementById('native-snap-btn');
    if (nativeSnapBtn) {
        nativeSnapBtn.addEventListener('click', () => {
            mediaInput.setAttribute('capture', 'environment');
            mediaInput.click();
        });
    }
    const galleryBtn = document.getElementById('gallery-btn');
    if (galleryBtn) {
        galleryBtn.addEventListener('click', () => {
            mediaInput.removeAttribute('capture');
            mediaInput.click();
        });
    }

    mediaInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            await runAIVisionScan(event.target.result.split(',')[1]);
        };
        reader.readAsDataURL(file);
    });
}

// Scanner Result Listeners (Moved to initialization block at bottom)

// Natural Language AI Logging (Cal AI style)
const aiTextBtn = document.getElementById('ai-text-btn');
if (aiTextBtn) {
    aiTextBtn.addEventListener('click', async () => {
        const desc = document.getElementById('ai-text-desc').value.trim();
        if (!desc) return;

        aiTextBtn.disabled = true;
        loadingEl.classList.remove('hidden');
        loadingEl.querySelector('p').innerText = "AI parsing your meal...";

        const promptText = `Analyze this food description: "${desc}". Return ONLY a valid JSON object with: 
            "name" (string), "calories" (number), "protein" (number), "carbs" (number), "fat" (number),
            "confidence" (number, 0-100),
            "breakdown" (array of objects with "item", "calories", "protein", "carbs" and "fat" keys showing major ingredients found).
            STRICTLY ONLY JSON.`;

        // API Key Check
        if (!state.apiKey) {
            alert("Please go to the Profile tab and enter a Google AI API Key to use this feature.");
            document.querySelector('.nav-item[data-target="view-profile"]').click();
            loadingEl.classList.add('hidden');
            aiTextBtn.disabled = false;
            return;
        }

        try {
            const payload = {
                contents: [{ parts: [{ text: promptText }] }]
                // removed responseMimeType to prevent 400 errors
            };

            const res = await fetch(getGeminiUrl(state.apiKey, state.apiKeyModel), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(`Google API Error ${res.status}: ${errData.error?.message || "Check your API key."}`);
            }

            const data = await res.json();
            let textResult = data.candidates[0].content.parts[0].text;
            const match = textResult.match(/\{[\s\S]*\}/);
            const mealData = JSON.parse(match[0]);

            scannedMealTemp = {
                id: Date.now().toString(),
                name: mealData.name,
                calories: mealData.calories,
                protein: mealData.protein,
                carbs: mealData.carbs,
                fat: mealData.fat,
                confidence: mealData.confidence,
                breakdown: mealData.breakdown,
                timestamp: getDisplayDate().getTime()
            };

            // Populate Result UI
            document.getElementById('ai-meal-name').innerText = scannedMealTemp.name;
            document.getElementById('res-cal').innerText = scannedMealTemp.calories;
            document.getElementById('res-pro').innerText = scannedMealTemp.protein;
            document.getElementById('res-car').innerText = scannedMealTemp.carbs;
            document.getElementById('res-fat').innerText = scannedMealTemp.fat;
            document.getElementById('ai-confidence').innerText = `${scannedMealTemp.confidence}% Confidence`;
            
            const breakdownList = document.getElementById('ai-breakdown-list');
            breakdownList.innerHTML = '';
            mealData.breakdown.forEach(item => {
                const li = document.createElement('li');
                li.style = "margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.05);";
                li.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                        <span style="color:white; font-size:14px; font-weight:bold;">${item.item}</span>
                        <span style="color:var(--accent-blue); font-weight:bold;">${item.calories} kcal</span>
                    </div>
                    <div style="display:flex; gap:10px; font-size:11px; color:var(--text-secondary);">
                        <span>P: <b style="color:var(--color-protein);">${item.protein || 0}g</b></span>
                        <span>C: <b style="color:var(--color-carbs);">${item.carbs || 0}g</b></span>
                        <span>F: <b style="color:var(--color-fat);">${item.fat || 0}g</b></span>
                    </div>
                `;
                breakdownList.appendChild(li);
            });
            document.getElementById('ai-breakdown-container').classList.remove('hidden');

            loadingEl.classList.add('hidden');
            resultEl.classList.remove('hidden');
            document.getElementById('ai-text-desc').value = '';
        } catch (e) {
            alert("AI couldn't understand that. Try being more specific!");
        } finally {
            aiTextBtn.disabled = false;
        }
    });
}

// === MANUAL BARCODE FETCH ===
async function lookupBarcodeOpenFoodFacts(barcode) {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await res.json();
    if (data.status !== 1) {
        throw new Error("Barcode not found in database. Try scanning the nutrition label manually!");
    }
    const n = data.product.nutriments || {};
    const s = '_serving'; // fallback heavily to 100g if serving is missing from db
    
    // Some products only report energy-kcal, fallback cascading safely
    const cal = Math.round(n['energy-kcal'+s] || n['energy-kcal_100g'] || n['energy-kcal'] || 0);
    const pro = Math.round(n['proteins'+s] || n['proteins_100g'] || 0);
    const car = Math.round(n['carbohydrates'+s] || n['carbohydrates_100g'] || 0);
    const fat = Math.round(n['fat'+s] || n['fat_100g'] || 0);

    return {
        name: data.product.product_name_en || data.product.product_name || `Scanned Item`,
        calories: cal, protein: pro, carbs: car, fat: fat
    };
}

const manBarcodeBtn = document.getElementById('man-barcode-btn');
if (manBarcodeBtn) {
    manBarcodeBtn.addEventListener('click', async () => {
        const val = document.getElementById('man-barcode-input').value.trim();
        if (!val) return;
        const statEl = document.getElementById('barcode-status');
        statEl.style.display = 'block';
        statEl.innerText = 'Searching Database...';
        statEl.style.color = 'var(--text-secondary)';
        
        try {
            const result = await lookupBarcodeOpenFoodFacts(val);
            document.getElementById('man-name').value = result.name;
            document.getElementById('man-cal').value = result.calories;
            document.getElementById('man-pro').value = result.protein;
            document.getElementById('man-car').value = result.carbs;
            document.getElementById('man-fat').value = result.fat;
            statEl.innerText = 'Found Item!';
            statEl.style.color = 'var(--accent-blue)';
            document.getElementById('man-barcode-input').value = '';
        } catch(e) {
            statEl.innerText = e.message;
            statEl.style.color = 'var(--color-protein)';
        }
    });
}


// Duplicate listeners removed and merged into lines 485-508 for cleaner logic.

// Manual Log Save
document.getElementById('man-save-btn').addEventListener('click', () => {
    const cal = parseInt(document.getElementById('man-cal').value) || 0;
    const pro = parseInt(document.getElementById('man-pro').value) || 0;
    const carb = parseInt(document.getElementById('man-car').value) || 0;
    const fat = parseInt(document.getElementById('man-fat').value) || 0;
    const type = document.getElementById('man-meal-type').value;
    const name = document.getElementById('man-name').value.trim() || "Manual Log";

    if (!cal && !pro && !carb && !fat) return alert("Please enter at least one macro to log.");

    state.meals.push({
        id: Date.now().toString(),
        name,
        calories: cal, protein: pro, carbs: carb, fat,
        type,
        timestamp: getDisplayDate().getTime() // Inject historical target instead of real-time
    });
    saveState();
    
    // Removed form clearing so information stays for each update
    // document.getElementById('man-cal').value = '';
    // document.getElementById('man-pro').value = '';
    // document.getElementById('man-car').value = '';
    // document.getElementById('man-fat').value = '';
    // document.getElementById('man-name').value = '';
    document.querySelector('.nav-item[data-target="view-dashboard"]').click();
});


// === WEIGHT TRACKING ===
let weightChartInstance = null;

// === WEIGHT LOGGING EXPANSE ===
let tempWeightPhotoBase64 = null;
const photoInput = document.getElementById('weight-photo');
const photoStatus = document.getElementById('photo-status');

photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    photoStatus.innerText = "Processing image...";
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // Aggressive compression for localStorage
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
                if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // 50% Quality JPEG saves megabytes of data
            tempWeightPhotoBase64 = canvas.toDataURL('image/jpeg', 0.5); 
            photoStatus.innerText = "Progress photo attached securely!";
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});


document.getElementById('add-weight-btn').addEventListener('click', () => {
    const inputEl = document.getElementById('weight-input');
    const val = parseFloat(inputEl.value);
    if (!val) return;

    state.weights.push({
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('en-US'),
        weight: val,
        photo: tempWeightPhotoBase64,
        timestamp: new Date().getTime()
    });
    
    // Sort & Reset
    state.weights.sort((a,b) => a.timestamp - b.timestamp);
    inputEl.value = '';
    tempWeightPhotoBase64 = null;
    photoStatus.innerText = '';
    
    saveState();
    renderWeightChart();
});

function renderWeights() {
    let html = '';
    const reversed = [...state.weights].reverse(); // newest first
    
    reversed.forEach(w => {
        let photoHTML = '';
        if (w.photo) {
            photoHTML = `<img src="${w.photo}" style="width:50px; height:50px; border-radius:4px; object-fit:cover; margin-right:12px; cursor:pointer;" onclick="openPhotoModal('${w.photo}')">`;
        }

        html += `
            <div class="list-item">
                <div style="display:flex; align-items:center;">
                    ${photoHTML}
                    <div class="list-item-title">${w.date}</div>
                </div>
                <div class="list-item-val" style="display:flex; align-items:center; gap:12px;">
                    <span>${w.weight} lbs</span>
                    <button class="btn btn-secondary" onclick="deleteWeight('${w.id}')" style="padding: 6px; border:1px solid rgba(255,51,102,0.2); color:#ff3366;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });

    if (reversed.length === 0) {
        html = `<div class="empty-state">No weight history yet.</div>`;
    }
    document.getElementById('weight-list').innerHTML = html;
}

// Lightbox Logic
window.openPhotoModal = function(base64) {
    const modal = document.getElementById('photo-modal');
    if (!modal) return;
    document.getElementById('photo-modal-img').src = base64;
    modal.classList.remove('hidden');
};

const modalBg = document.getElementById('photo-modal');
if (modalBg) {
    modalBg.addEventListener('click', () => {
        modalBg.classList.add('hidden');
    });
}

function renderWeightChart() {
    renderWeights(); // ensures history list is synced

    const canvas = document.getElementById('weightChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    if (weightChartInstance) {
        weightChartInstance.destroy();
    }

    const labels = state.weights.map(w => w.date);
    const dataPts = state.weights.map(w => w.weight);

    weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Weight (lbs)',
                data: dataPts.length ? dataPts : [0],
                borderColor: '#00e5ff',
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#00e5ff',
                pointBorderColor: '#00e5ff',
                pointRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}


// === RECIPES ===
document.getElementById('add-recipe-btn').addEventListener('click', () => {
    const nameEl = document.getElementById('recipe-name');
    const calEl = document.getElementById('rec-cal');
    const proEl = document.getElementById('rec-pro');
    const carEl = document.getElementById('rec-car');
    const fatEl = document.getElementById('rec-fat');

    const name = nameEl.value.trim();
    if (!name) return alert("Please enter a recipe name.");

    const recipe = {
        id: Date.now().toString(),
        name,
        calories: parseInt(calEl.value) || 0,
        protein: parseInt(proEl.value) || 0,
        carbs: parseInt(carEl.value) || 0,
        fat: parseInt(fatEl.value) || 0,
    };

    state.recipes.push(recipe);
    saveState();
    
    // clear form
    nameEl.value = ''; calEl.value = ''; proEl.value = ''; carEl.value = ''; fatEl.value = '';
});

window.deleteRecipe = function(id) {
    if (confirm("Are you sure you want to delete this recipe?")) {
        state.recipes = state.recipes.filter(r => r.id !== id);
        saveState();
    }
};

function renderRecipes() {
    let html = '';
    
    state.recipes.forEach(r => {
        html += `
            <div class="list-item">
                <div>
                    <div class="list-item-title">${r.name}</div>
                    <div class="list-item-sub">${r.protein}g P • ${r.carbs}g C • ${r.fat}g F</div>
                </div>
                <div class="list-item-val" style="display:flex; flex-direction:column; align-items:flex-end;">
                    <span>${r.calories} kcal</span>
                    <div style="display:flex; gap:8px; margin-top:4px;">
                        <button class="btn btn-secondary" onclick="deleteRecipe('${r.id}')" style="padding: 4px 8px; font-size: 12px; border:1px solid rgba(255,51,102,0.2); color:#ff3366;"><i class="fa-solid fa-trash"></i></button>
                        <button class="btn btn-secondary" onclick="logRecipe('${r.id}')" style="padding: 4px 8px; font-size: 12px; background:var(--accent-blue); color:#000;">Log</button>
                    </div>
                </div>
            </div>
        `;
    });

    if (state.recipes.length === 0) {
        html = `<div class="empty-state">No recipes saved.</div>`;
    }
    document.getElementById('recipe-list').innerHTML = html;
}

// --- Modal Logic for Logging ---
let pendingLogMealData = null;

function openLogModal(title, mealData) {
    pendingLogMealData = mealData;
    document.getElementById('log-modal-title').innerText = `Log ${title}`;
    document.getElementById('log-type-modal').classList.remove('hidden');
}

document.getElementById('close-log-modal')?.addEventListener('click', () => {
    document.getElementById('log-type-modal').classList.add('hidden');
    pendingLogMealData = null;
});

document.getElementById('log-modal-confirm')?.addEventListener('click', () => {
    if (!pendingLogMealData) return;
    const type = document.getElementById('log-modal-type').value;
    pendingLogMealData.type = type;
    
    state.meals.push(pendingLogMealData);
    saveState();
    
    document.getElementById('log-type-modal').classList.add('hidden');
    alert(`Logged ${pendingLogMealData.name}!`);
    pendingLogMealData = null;
    document.querySelector('.nav-item[data-target="view-dashboard"]').click();
});

window.logRecipe = function(id) {
    const recipe = state.recipes.find(r => r.id === id);
    if (!recipe) return;
    
    const mealData = {
        id: Date.now().toString(),
        name: recipe.name,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        timestamp: getDisplayDate().getTime()
    };
    
    openLogModal(recipe.name, mealData);
};

// === DELETION METHODS ===
window.deleteMeal = function(id) {
    if (confirm("Are you sure you want to delete this meal?")) {
        state.meals = state.meals.filter(m => m.id !== id);
        saveState();
    }
};

window.deleteWeight = function(id) {
    if (confirm("Are you sure you want to delete this weight log?")) {
        state.weights = state.weights.filter(w => w.id !== id);
        saveState();
    }
};

// === PROFILE AND ONBOARDING ===


document.getElementById('ob-submit-btn').addEventListener('click', () => {
    const gender = document.getElementById('ob-gender').value;
    const age = parseInt(document.getElementById('ob-age').value);
    const height = parseInt(document.getElementById('ob-height').value);
    const weight = parseInt(document.getElementById('ob-weight').value);
    const goalWeight = parseInt(document.getElementById('ob-goal').value);
    const activity = parseFloat(document.getElementById('ob-activity').value);

    if (!age || !height || !weight || !goalWeight) {
        return alert("Please fill out all fields correctly.");
    }

    // Convert to Metric for Mifflin-St Jeor BMR
    const weightKg = weight / 2.205;
    const heightCm = height * 2.54;

    let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
    bmr += (gender === 'male') ? 5 : -161;

    let tdee = bmr * activity;

    // Calculate Deficit/Surplus based on Goal
    let dailyCalories = tdee;
    if (goalWeight < weight) {
        dailyCalories -= 500; // 500 cal deficit (~1lb/week loss)
    } else if (goalWeight > weight) {
        dailyCalories += 500; // 500 cal surplus
    }
    
    // Floor it to at least 1200 for safety bounds visually
    dailyCalories = Math.max(Math.round(dailyCalories), 1200); 

    // Macros: 1g protein per lb of body weight, 25% fat, rest carbs
    const protein = Math.round(weight * 1); // 1g per lb
    const fat = Math.round((dailyCalories * 0.25) / 9);
    
    const remainingCals = dailyCalories - (protein * 4) - (fat * 9);
    const carbs = Math.max(Math.round(remainingCals / 4), 0);

    state.profile = {
        gender, age, height, weight, goalWeight, activity,
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        macros: { calories: dailyCalories, protein, carbs, fat }
    };

    saveState();
    
    // Hide overlay
    document.getElementById('view-onboarding').classList.add('hidden');
});

document.getElementById('recalculate-btn').addEventListener('click', () => {
    document.getElementById('view-onboarding').classList.remove('hidden');
});


// === PROGRESS TABS (WEIGHT VS WORKOUTS) ===
const tabWeightBtn = document.getElementById('tab-weight-btn');
const tabWorkoutBtn = document.getElementById('tab-workout-btn');
const subWeight = document.getElementById('subview-weight');
const subWorkouts = document.getElementById('subview-workouts');

tabWeightBtn.addEventListener('click', () => {
    tabWeightBtn.classList.replace('btn-secondary', 'btn-primary');
    tabWorkoutBtn.classList.replace('btn-primary', 'btn-secondary');
    subWeight.classList.remove('hidden');
    subWorkouts.classList.add('hidden');
});

tabWorkoutBtn.addEventListener('click', () => {
    tabWorkoutBtn.classList.replace('btn-secondary', 'btn-primary');
    tabWeightBtn.classList.replace('btn-primary', 'btn-secondary');
    subWeight.classList.add('hidden');
    subWorkouts.classList.remove('hidden');
    renderWorkouts();
});

// === WORKOUT LOGGER ===
let activeWorkout = null;

document.getElementById('new-workout-btn').addEventListener('click', () => {
    activeWorkout = {
        name: "",
        date: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        timestamp: new Date().getTime(),
        exercises: []
    };
    
    document.getElementById('workout-name').value = '';
    document.getElementById('workout-history').classList.add('hidden');
    document.getElementById('active-workout-view').classList.remove('hidden');
    renderActiveWorkout();
});

document.getElementById('cancel-workout-btn').addEventListener('click', () => {
    activeWorkout = null;
    document.getElementById('active-workout-view').classList.add('hidden');
    document.getElementById('workout-history').classList.remove('hidden');
});

document.getElementById('add-exercise-btn').addEventListener('click', () => {
    if (!activeWorkout) return;
    const select = document.getElementById('exercise-select');
    let exName = select.value;
    
    if (exName === 'Custom...') {
        exName = prompt("Enter custom exercise name:");
        if (!exName) return;
    }
    
    activeWorkout.exercises.push({
        id: Date.now().toString(),
        name: exName,
        sets: [] // array of { weight, reps }
    });
    
    renderActiveWorkout();
});

window.addSet = function(exIdx) {
    activeWorkout.exercises[exIdx].sets.push({ weight: 0, reps: 0 });
    renderActiveWorkout();
};

window.updateSet = function(exIdx, setIdx, field, val) {
    activeWorkout.exercises[exIdx].sets[setIdx][field] = parseFloat(val) || 0;
};

function renderActiveWorkout() {
    if (!activeWorkout) return;
    
    let html = '';
    activeWorkout.exercises.forEach((ex, exIdx) => {
        let setsHTML = '';
        ex.sets.forEach((s, setIdx) => {
            setsHTML += `
                <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                    <span style="color:var(--text-secondary); width: 20px;">${setIdx + 1}</span>
                    <input type="number" placeholder="lbs" class="input-full" style="padding:8px; margin:0; flex:1;" value="${s.weight || ''}" onchange="updateSet(${exIdx}, ${setIdx}, 'weight', this.value)">
                    <input type="number" placeholder="reps" class="input-full" style="padding:8px; margin:0; flex:1;" value="${s.reps || ''}" onchange="updateSet(${exIdx}, ${setIdx}, 'reps', this.value)">
                </div>
            `;
        });
        
        html += `
            <div class="card" style="margin-bottom:16px; background:rgba(0,0,0,0.4);">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <h4 style="color:var(--accent-blue);">${ex.name}</h4>
                </div>
                ${setsHTML}
                <button class="btn btn-secondary full-width" onclick="addSet(${exIdx})" style="padding:8px; font-size:14px; margin-top:8px;">+ Add Set</button>
            </div>
        `;
    });
    
    document.getElementById('active-exercises-list').innerHTML = html;
}

document.getElementById('finish-workout-btn').addEventListener('click', () => {
    if (!activeWorkout) return;
    
    let name = document.getElementById('workout-name').value;
    activeWorkout.name = name || "Workout";
    
    state.workouts.push(activeWorkout);
    saveState();
    
    activeWorkout = null;
    document.getElementById('active-workout-view').classList.add('hidden');
    document.getElementById('workout-history').classList.remove('hidden');
    renderWorkouts();
});

function renderWorkouts() {
    let html = '';
    const reversed = [...state.workouts].reverse();
    
    reversed.forEach(wo => {
        const totalSets = wo.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
        
        let exercisesHTML = '';
        wo.exercises.forEach(ex => {
            let setDetails = [];
            ex.sets.forEach(s => setDetails.push(`${s.weight}lbs x ${s.reps}`));
            exercisesHTML += `
                <div style="margin-top:12px; border-left:2px solid var(--accent-blue); padding-left:12px;">
                    <div style="color:white; font-size:14px; font-weight:bold;">${ex.name} (${ex.sets.length} sets)</div>
                    <div style="color:var(--text-secondary); font-size:12px; margin-top:4px;">${setDetails.join(' • ')}</div>
                </div>
            `;
        });

        const accId = `wo-${wo.timestamp}`;

        html += `
            <div class="card form-card" style="margin-bottom:12px;">
                <div id="header-${accId}" class="accordion-header" style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:8px; cursor:pointer;" onclick="toggleAccordion('${accId}')">
                    <div style="flex:1;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-chevron-down" style="color:var(--text-secondary); font-size:12px;"></i>
                            <div class="list-item-title">${wo.name}</div>
                        </div>
                        <div class="list-item-sub" style="margin-top:4px; padding-left:20px;">${wo.date} • ${wo.exercises.length} Exercises</div>
                    </div>
                    <div>
                        <button class="btn btn-secondary" onclick="event.stopPropagation(); deleteWorkout('${wo.timestamp}')" style="padding: 6px; border:1px solid rgba(255,51,102,0.2); color:#ff3366;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div id="${accId}" class="accordion-content">
                    <div style="padding-top:8px; border-top:1px solid rgba(255,255,255,0.05); margin-top:8px; padding-bottom:8px;">
                        ${exercisesHTML}
                    </div>
                </div>
            </div>
        `;
    });

    if (reversed.length === 0) {
        html = '<div class="empty-state">No workouts tracked yet. Get lifting!</div>';
    }
    
    document.getElementById('workout-list').innerHTML = html;
}

window.deleteWorkout = function(ts) {
    if (confirm("Delete this workout?")) {
        state.workouts = state.workouts.filter(w => w.timestamp != ts);
        saveState();
        renderWorkouts();
    }
}

// === WATER & RECENT MEALS HELPERS ===
window.updateWater = function(val) {
    state.waterIntake = Math.max(0, state.waterIntake + val);
    saveState();
};

function addRecentMeal(meal) {
    // Keep unique by name, most recent first
    state.recentMeals = state.recentMeals.filter(m => m.name !== meal.name);
    state.recentMeals.unshift(meal);
    state.recentMeals = state.recentMeals.slice(0, 10); // Limit to top 10
}

function renderRecentMeals() {
    const list = document.getElementById('recent-list');
    if (!list) return;
    
    if (state.recentMeals.length === 0) {
        list.innerHTML = '<div class="empty-state" style="font-size:12px;">No recent meals yet.</div>';
        return;
    }

    list.innerHTML = '';
    state.recentMeals.forEach(meal => {
        const item = document.createElement('div');
        item.className = 'card';
        item.style = "min-width:140px; padding:12px; cursor:pointer; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);";
        item.innerHTML = `
            <div style="font-size:13px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${meal.name}</div>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">${meal.calories} kcal</div>
        `;
        item.onclick = () => {
            const mealData = {
                ...meal,
                id: Date.now().toString(),
                timestamp: getDisplayDate().getTime()
            };
            openLogModal(meal.name, mealData);
        };
        list.appendChild(item);
    });
}

// === PROFILE & GOALS ===
function renderProfile() {
    if (!state.profile) return;
    
    // Update Current Goals Display
    const profCal = document.getElementById('prof-cal');
    const profPro = document.getElementById('prof-pro');
    const profCar = document.getElementById('prof-car');
    const profFat = document.getElementById('prof-fat');
    if (profCal) profCal.innerText = MACRO_GOALS.calories || 0;
    if (profPro) profPro.innerText = MACRO_GOALS.protein || 0;
    if (profCar) profCar.innerText = MACRO_GOALS.carbs || 0;
    if (profFat) profFat.innerText = MACRO_GOALS.fat || 0;

    // Update Goals form
    document.getElementById('manual-cal-goal').value = state.profile.macros.calories || 0;
    document.getElementById('manual-pro-goal').value = state.profile.macros.protein || 0;
    document.getElementById('manual-carb-goal').value = state.profile.macros.carbs || 0;
    document.getElementById('manual-fat-goal').value = state.profile.macros.fat || 0;
    
    // Update API Key Input & Verification
    const maskedKey = state.apiKey ? `Using key ending in: ...${state.apiKey.slice(-4)}` : "No key configured.";
    document.getElementById('api-key-input').value = state.apiKey || '';
    const statusEl = document.getElementById('api-key-status');
    if (statusEl) {
        statusEl.innerText = maskedKey;
        statusEl.style.color = state.apiKey ? "var(--text-secondary)" : "var(--color-protein)";
    }

    const list = document.getElementById('prof-stats-list');
    if (list) {
        list.innerHTML = '';
        const stats = [
            { label: 'Weight', val: state.profile.weight, unit: 'lbs' },
            { label: 'Height', val: state.profile.height, unit: 'in' },
            { label: 'Sex', val: (state.profile.gender || 'N/A').toUpperCase() },
            { label: 'BMR', val: Math.round(state.profile.bmr || 0), unit: 'kcal' },
            { label: 'TDEE', val: Math.round(state.profile.tdee || 0), unit: 'kcal' }
        ];

        stats.forEach(s => {
            const li = document.createElement('li');
            li.style = "display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); color:var(--text-secondary);";
            li.innerHTML = `<span>${s.label}</span> <span style="color:white; font-weight:bold;">${s.val} ${s.unit || ''}</span>`;
            list.appendChild(li);
        });
    }
}

// API Key Save
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', () => {
        const key = document.getElementById('api-key-input').value.trim();
        if (!key || !key.startsWith('AIza')) return alert("Please enter a valid Google API key (starts with AIza...)");
        
        state.apiKey = key;
        saveState();
        renderProfile();
        
        const status = document.getElementById('api-key-status');
        if (status) {
            status.innerText = "Secret key saved! (Stored on device only)";
            status.style.color = "var(--accent-blue)";
        }
    });
}

// AI Connection Tester (Fixes 404/400 errors)
const testApiKeyBtn = document.getElementById('test-api-key-btn');
if (testApiKeyBtn) {
    testApiKeyBtn.addEventListener('click', async () => {
        const key = state.apiKey;
        if (!key) return alert("Please save an API key first.");
        
        const status = document.getElementById('api-key-status');
        status.innerText = "⏳ Scanning Google Models...";
        status.style.color = "var(--text-secondary)";
        
        try {
            // Step 1: List all models available to this key
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
            const res = await fetch(listUrl);
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error?.message || "Invalid Key");

            // Step 2: Look for 'flash' or 'pro' models
            const models = data.models || [];
            const flashModel = models.find(m => m.name.includes('flash') && m.supportedGenerationMethods.includes('generateContent'));
            
            if (flashModel) {
                const modelId = flashModel.name.split('/')[1];
                state.apiKeyModel = modelId;
                saveState();
                status.innerText = `✅ Found compatible engine: ${modelId}`;
                status.style.color = "var(--accent-blue)";
                renderProfile();
            } else {
                throw new Error("No compatible AI models found for this key.");
            }
        } catch (err) {
            status.innerText = `❌ Connection Failed: ${err.message}`;
            status.style.color = "var(--color-protein)";
        }
    });
}

// === INITIALIZATION & STABLE LISTENERS ===
function initApp() {
    console.log("NutraTrack: Initializing App...");
    try {
        if (!state.profile) {
            document.getElementById('view-onboarding').classList.remove('hidden');
        } else {
            // Restore Goals across UI
            if (state.profile.macros) {
                MACRO_GOALS = state.profile.macros;
                const calGoalInput = document.getElementById('manual-cal-goal');
                if (calGoalInput) calGoalInput.value = MACRO_GOALS.calories || 0;
                
                const proGoalInput = document.getElementById('manual-pro-goal');
                if (proGoalInput) proGoalInput.value = MACRO_GOALS.protein || 0;
                
                const carbGoalInput = document.getElementById('manual-carb-goal');
                if (carbGoalInput) carbGoalInput.value = MACRO_GOALS.carbs || 0;
                
                const fatGoalInput = document.getElementById('manual-fat-goal');
                if (fatGoalInput) fatGoalInput.value = MACRO_GOALS.fat || 0;
            }
        }

        renderDashboard();
        renderRecipes();
        renderProfile();
        renderWorkouts();
        renderRecentMeals();
        
        console.log("NutraTrack: Ready.");
    } catch (err) {
        console.error("NutraTrack: Startup Error:", err);
    }
}

// === INITIALIZATION & STABLE LISTENERS ===
function initApp() {
    console.log("NutraTrack: Initializing App...");
    try {
        if (!state.profile) {
            document.getElementById('view-onboarding').classList.remove('hidden');
        } else {
            // Restore Goals across UI
            if (state.profile.macros) {
                MACRO_GOALS = state.profile.macros;
                const calGoalInput = document.getElementById('manual-cal-goal');
                if (calGoalInput) calGoalInput.value = MACRO_GOALS.calories || 0;
                
                const proGoalInput = document.getElementById('manual-pro-goal');
                if (proGoalInput) proGoalInput.value = MACRO_GOALS.protein || 0;
                
                const carbGoalInput = document.getElementById('manual-carb-goal');
                if (carbGoalInput) carbGoalInput.value = MACRO_GOALS.carbs || 0;
                
                const fatGoalInput = document.getElementById('manual-fat-goal');
                if (fatGoalInput) fatGoalInput.value = MACRO_GOALS.fat || 0;
            }
        }

        renderDashboard();
        renderRecipes();
        renderProfile();
        renderWorkouts();
        renderRecentMeals();
        
        console.log("NutraTrack: Ready.");
    } catch (err) {
        console.error("NutraTrack: Startup Error:", err);
        alert("Startup Error: " + err.message);
    }
}

// Global Error Handler for debugging
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error("Global Error:", msg, "at", url, ":", lineNo);
    // Only alert for major script failures
    if (msg.toLowerCase().indexOf('script error') > -1) {
        alert('Script Error: See Console for details');
    } else {
        // Optionally alert user during debug phase
        // alert(msg + '\n' + url + ':' + lineNo);
    }
    return false;
};

// Final Global Listeners Attached AFTER DOM functions ready
function setupListeners() {
    console.log("NutraTrack: Setting up listeners...");

    // 1. Scanner Results
    const discardBtn = document.getElementById('discard-meal-btn');
    if (discardBtn) {
        discardBtn.onclick = () => {
            console.log("Scanner: Discarding result.");
            scannedMealTemp = null;
            resultEl.classList.add('hidden');
            captureBtn.classList.remove('hidden');
            document.getElementById('take-photo-btn').classList.remove('hidden');
        };
    }

    const saveMealBtn = document.getElementById('save-meal-btn');
    if (saveMealBtn) {
        saveMealBtn.onclick = () => {
            console.log("Scanner: Saving result.");
            if (!scannedMealTemp) return console.warn("Scanner: No temp data.");
            
            scannedMealTemp.type = document.getElementById('res-meal-type').value;
            state.meals.push(scannedMealTemp);
            
            addRecentMeal({
                name: scannedMealTemp.name,
                calories: scannedMealTemp.calories,
                protein: scannedMealTemp.protein,
                carbs: scannedMealTemp.carbs,
                fat: scannedMealTemp.fat
            });

            saveState();
            scannedMealTemp = null;
            
            resultEl.classList.add('hidden');
            captureBtn.classList.remove('hidden');
            document.getElementById('take-photo-btn').classList.remove('hidden');
            document.querySelector('.nav-item[data-target="view-dashboard"]').click();
        };
    }

    // 2. Manual Goals Save
    const manualSaveBtn = document.getElementById('manual-save-btn');
    if (manualSaveBtn) {
        manualSaveBtn.onclick = () => {
            const cal = parseInt(document.getElementById('manual-cal-goal').value);
            const pro = parseInt(document.getElementById('manual-pro-goal').value);
            const carb = parseInt(document.getElementById('manual-carb-goal').value);
            const fat = parseInt(document.getElementById('manual-fat-goal').value);

            if (!cal || !pro || !carb || !fat) return alert("Please fill all macro goals.");

            if (!state.profile) {
                state.profile = { age: 0, height: 0, weight: 0, goalWeight: 0, gender: 'N/A', activity: 1, macros: {} };
            }
            
            state.profile.macros = { calories: cal, protein: pro, carbs: carb, fat: fat };
            saveState();
            alert("Goals updated successfully!");
        };
    }
}

// Execute immediately since we are at bottom of body
setupListeners();
initApp();

