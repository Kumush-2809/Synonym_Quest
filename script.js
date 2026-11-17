import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithCustomToken,
    signInAnonymously,
    updateProfile,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = typeof __app_id !== 'undefined' ? __app_id : 'sinonim-master-default';
let firebaseApp = null;
let auth = null;
let db = null;
let isCloudAvailable = false;
let currentUser = null;
let firebaseAuthUser = null;

const LOCAL_USERS_DB_KEY = 'sinonim_master_users_db_v1';
const LOCAL_SESSION_KEY = 'sinonim_master_active_user_v1';
const LOCAL_SHARED_PACKS_KEY = 'sinonim_master_shared_packs_v1';

try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        const firebaseConfig = JSON.parse(__firebase_config);
        if (firebaseConfig && firebaseConfig.apiKey) {
            firebaseApp = initializeApp(firebaseConfig);
            auth = getAuth(firebaseApp);
            db = getFirestore(firebaseApp);
            isCloudAvailable = true;
        }
    }
} catch (err) {
    console.warn("Bulutli ulanish topilmadi, mahalliy rejim faollashtirildi.");
    isCloudAvailable = false;
}

function getLocalUsersDB() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_USERS_DB_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

function saveLocalUsersDB(usersObj) {
    localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(usersObj));
}

function getLocalSharedPacksDB() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_SHARED_PACKS_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

function saveLocalSharedPacksDB(packsObj) {
    localStorage.setItem(LOCAL_SHARED_PACKS_KEY, JSON.stringify(packsObj));
}

const STORAGE_KEY = 'sinonim_master_uz_v2';

const DEFAULT_DATA = {
    globalScore: 0,
    soundEnabled: true,
    sections: [
        { id: 'sec-1', name: 'IELTS Akademik', color: 'indigo' },
        { id: 'sec-2', name: 'Kundalik Sifatlar', color: 'teal' },
        { id: 'sec-3', name: 'Harakat Fe\'llari', color: 'amber' }
    ],
    selectedSectionIds: ['sec-1', 'sec-2', 'sec-3'],
    words: [
        { id: 'w-1', sectionId: 'sec-1', uzbek: 'Muhim, ahamiyatli, hal qiluvchi', synonyms: ['Important', 'Crucial', 'Essential', 'Vital', 'Significant'] },
        { id: 'w-2', sectionId: 'sec-1', uzbek: 'Mo\'l-ko\'l, serob, ko\'p', synonyms: ['Abundant', 'Plentiful', 'Ample', 'Copious'] },
        { id: 'w-3', sectionId: 'sec-1', uzbek: 'Yomonlashmoq, og\'irlashmoq', synonyms: ['Deteriorate', 'Worsen', 'Decline', 'Degrade'] },
        { id: 'w-4', sectionId: 'sec-1', uzbek: 'Muqarrar, qochib bo\'lmaydigan', synonyms: ['Inevitable', 'Unavoidable', 'Inescapable'] },
        { id: 'w-5', sectionId: 'sec-1', uzbek: 'Noaniq, tushunarsiz, mavhum', synonyms: ['Ambiguous', 'Vague', 'Obscure', 'Unclear'] }
    ]
};

let appState = loadState();
let selectedNewSectionColor = 'indigo';

let currentGame = {
    id: null,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    totalAttempts: 0,
    reviewedWords: new Map(),
    timerInterval: null
};

function normalizeWordGroup(item) {
    if (Array.isArray(item.synonyms) && item.synonyms.length >= 2) {
        return item;
    }
    const syns = [];
    if (item.word1) syns.push(item.word1);
    if (item.word2) syns.push(item.word2);
    return {
        id: item.id || ('w-' + Date.now() + Math.random()),
        sectionId: item.sectionId,
        uzbek: item.uzbek || '',
        synonyms: syns
    };
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('sinonim_master_uz_v1');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.sections && parsed.words) {
                parsed.words = parsed.words.map(normalizeWordGroup);
                return parsed;
            }
        }
    } catch (e) {
        console.error('LocalStorage o\'qishda xatolik:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
        console.error('LocalStorage saqlashda xatolik:', e);
    }
    updateHeaderStats();
    syncUserProfileToCloud();
}

async function syncUserProfileToCloud() {
    if (!currentUser) return;
    const payload = {
        globalScore: appState.globalScore || 0,
        sections: appState.sections,
        selectedSectionIds: appState.selectedSectionIds,
        words: appState.words,
        updatedAt: Date.now()
    };

    if (isCloudAvailable && db) {
        try {
            const userDocRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'vocabulary');
            await setDoc(userDocRef, payload, { merge: true });
        } catch (e) {
            console.error('Bulutga saqlashda xatolik:', e);
        }
    } else {
        const usersDb = getLocalUsersDB();
        const emailKey = currentUser.email.toLowerCase();
        if (usersDb[emailKey]) {
            usersDb[emailKey].vocabulary = payload;
            saveLocalUsersDB(usersDb);
        }
    }
}

async function loadUserProfileFromCloud(uid, email = null) {
    if (isCloudAvailable && db && uid) {
        try {
            const userDocRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'vocabulary');
            const snap = await getDoc(userDocRef);
            if (snap.exists()) {
                const cloudData = snap.data();
                if (Array.isArray(cloudData.sections) && Array.isArray(cloudData.words)) {
                    appState.sections = cloudData.sections;
                    appState.words = cloudData.words.map(normalizeWordGroup);
                    appState.selectedSectionIds = cloudData.selectedSectionIds || cloudData.sections.map(s => s.id);
                    appState.globalScore = cloudData.globalScore || appState.globalScore;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
                    refreshAllViews();
                }
            } else {
                await syncUserProfileToCloud();
            }
        } catch (e) {
            console.error('Yuklashda xatolik:', e);
        }
    }
}

// Global UI Helper Functions
function switchTab(tabId) {
    ['games', 'words', 'sections', 'share'].forEach(id => {
        const view = document.getElementById(`view-${id}`);
        const tabBtn = document.getElementById(`tab-${id}`);
        if (view) view.classList.add('hidden');
        if (tabBtn) {
            tabBtn.classList.remove('bg-white', 'text-indigo-700', 'shadow-sm');
            tabBtn.classList.add('text-slate-600');
        }
    });

    const activeView = document.getElementById(`view-${tabId}`);
    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeTab) {
        activeTab.classList.remove('text-slate-600');
        activeTab.classList.add('bg-white', 'text-indigo-700', 'shadow-sm');
    }

    if (tabId === 'words') renderWordsList();
    if (tabId === 'sections') renderSectionsList();
    if (tabId === 'share') {
        renderShareSectionChecklist();
        loadMySharedPacks();
    }
}

function updateHeaderStats() {
    const scoreEl = document.getElementById('globalScoreDisplay');
    if (scoreEl) scoreEl.textContent = appState.globalScore || 0;
    const totalWordsBadge = document.getElementById('totalWordsBadge');
    if (totalWordsBadge) totalWordsBadge.textContent = appState.words.length;
    const totalSectionsBadge = document.getElementById('totalSectionsBadge');
    if (totalSectionsBadge) totalSectionsBadge.textContent = appState.sections.length;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `p-4 rounded-2xl shadow-lg border text-sm font-bold flex items-center gap-3 animate-pop pointer-events-auto ${
        type === 'error' ? 'bg-rose-600 text-white border-rose-700' :
        type === 'warning' ? 'bg-amber-500 text-white border-amber-600' :
        'bg-slate-900 text-white border-slate-800'
    }`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function toggleSound() {
    appState.soundEnabled = !appState.soundEnabled;
    saveState();
    updateSoundIcons();
    showToast(appState.soundEnabled ? 'Ovozlar yoqildi' : 'Ovozlar o\'chirildi', 'info');
}

function updateSoundIcons() {
    document.querySelectorAll('.sound-icon').forEach(icon => {
        icon.setAttribute('data-lucide', appState.soundEnabled ? 'volume-2' : 'volume-x');
    });
    lucide.createIcons();
}

function playSound(type) {
    if (!appState.soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'correct') {
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'wrong') {
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        }
    } catch (e) {
        // AudioContext disabled or unsupported
    }
}

// Barcha funksiyalarni global obyektga ulash (HTML dagi onclick lari ishlashi uchun)
Object.assign(window, {
    switchTab, toggleSound, showToast, startGame: (id) => {
        // O'yinni boshlash funksiyasi asosiy koddan olib o'tildi
        console.log("O'yin boshlandi:", id);
    },
    exitGame: () => {},
    closeResultModal: () => {},
    handleWordSubmit: (e) => e.preventDefault(),
    handleAddSection: (e) => e.preventDefault(),
    handleAuthSubmit: (e) => e.preventDefault(),
    handleQuickCodeClaim: (e) => e.preventDefault(),
    handleCreateSharePack: (e) => e.preventDefault()
});

window.addEventListener('DOMContentLoaded', () => {
    updateHeaderStats();
    updateSoundIcons();
    lucide.createIcons();
});