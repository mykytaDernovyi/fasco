import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
    getAuth, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut as fbSignOut, sendPasswordResetEmail,
    GoogleAuthProvider, signInWithPopup,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
    getFirestore, doc, getDoc, setDoc, updateDoc,
    collection, addDoc, serverTimestamp,
    query, where, getDocs, onSnapshot, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: 'AIzaSyAyHMOly-F3QlazoyJivgwTnGVMkKxH-sI',
    authDomain: 'fasco-xd.firebaseapp.com',
    projectId: 'fasco-xd',
    storageBucket: 'fasco-xd.firebasestorage.app',
    messagingSenderId: '118808687658',
    appId: '1:118808687658:web:0b0c654332ef9e1099bf53',
    measurementId: 'G-DWQ9D3T953',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const CART_KEY = 'fasco_cart';
const WISH_KEY = 'fasco_wishlist';

let currentUser = null;
let currentProfile = null;
const authListeners = new Set();

const readLocal = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};
const writeLocal = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
};

const userDoc = (uid) => doc(db, 'users', uid);
const stockDoc = (id) => doc(db, 'stock', String(id));

const cartKey = (it) => `${it.id}|${it.size || ''}|${it.color || ''}`;
const wishKey = (it) => String(it.id);

function defaultProfile(user, extra = {}) {
    const [fn, ...rest] = (user.displayName || '').split(' ');
    return {
        firstName: extra.firstName || fn || '',
        lastName: extra.lastName || rest.join(' ') || '',
        email: user.email || '',
        phone: extra.phone || user.phoneNumber || '',
        photoURL: user.photoURL || '',
        address: extra.address || '',
        city: extra.city || '',
        country: extra.country || '',
    };
}

async function ensureUserDoc(user, extraProfile = {}) {
    const ref = userDoc(user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    const initial = {
        profile: defaultProfile(user, extraProfile),
        cart: readLocal(CART_KEY),
        wishlist: readLocal(WISH_KEY),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initial);
    return initial;
}

// Ідемпотентний sync: бере remote як джерело істини й додає тільки
// нові локальні позиції. НЕ сумує qty — щоб не подвоювалось на reload.
async function syncWithRemote(user) {
    const ref = userDoc(user.uid);
    let snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, {
            profile: defaultProfile(user),
            cart: readLocal(CART_KEY),
            wishlist: readLocal(WISH_KEY),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        snap = await getDoc(ref);
    }
    const remote = snap.data() || {};
    const local = { cart: readLocal(CART_KEY), wishlist: readLocal(WISH_KEY) };

    const cartMap = new Map();
    let cartChanged = false;
    for (const it of (remote.cart || [])) cartMap.set(cartKey(it), { ...it });
    for (const it of (local.cart || [])) {
        const k = cartKey(it);
        const existing = cartMap.get(k);
        if (!existing) { cartMap.set(k, { ...it }); cartChanged = true; }
        else if ((it.qty || 0) > (existing.qty || 0)) {
            cartMap.set(k, { ...existing, qty: it.qty }); cartChanged = true;
        }
    }
    const cart = [...cartMap.values()];

    const wishMap = new Map();
    let wishChanged = false;
    for (const it of (remote.wishlist || [])) wishMap.set(wishKey(it), { ...it });
    for (const it of (local.wishlist || [])) {
        if (!wishMap.has(wishKey(it))) { wishMap.set(wishKey(it), { ...it }); wishChanged = true; }
    }
    const wishlist = [...wishMap.values()];

    if (cartChanged || wishChanged) {
        await setDoc(ref, { cart, wishlist, updatedAt: serverTimestamp() }, { merge: true });
    }
    writeLocal(CART_KEY, cart);
    writeLocal(WISH_KEY, wishlist);
    return { ...remote, cart, wishlist };
}

// Дебоунс запису кошика/вішліста у Firestore (300мс).
let saveTimer = null;
let pendingSyncData = null;
async function flushSync() {
    if (!currentUser || !pendingSyncData) return;
    const data = pendingSyncData;
    pendingSyncData = null;
    saveTimer = null;
    try {
        await updateDoc(userDoc(currentUser.uid), { ...data, updatedAt: serverTimestamp() });
    } catch (e) { console.warn('[Fasco] sync error', e); }
}
function scheduleRemoteSync() {
    if (!currentUser) return;
    pendingSyncData = { cart: readLocal(CART_KEY), wishlist: readLocal(WISH_KEY) };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSync, 300);
}
window.addEventListener('beforeunload', () => {
    if (saveTimer) { clearTimeout(saveTimer); flushSync(); }
});

function notifyAuthListeners() {
    for (const cb of authListeners) {
        try { cb(currentUser, currentProfile); } catch (e) { console.error(e); }
    }
}

// === AUTH ===

async function signUpWithEmail({ firstName, lastName, email, phone, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (firstName || lastName) {
        await updateProfile(cred.user, { displayName: `${firstName || ''} ${lastName || ''}`.trim() });
    }
    await ensureUserDoc(cred.user, { firstName, lastName, phone });
    return cred.user;
}
async function signInEmail({ email, password }) {
    return (await signInWithEmailAndPassword(auth, email, password)).user;
}
async function signInGoogle() {
    return (await signInWithPopup(auth, googleProvider)).user;
}
async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
}
async function logout() {
    if (saveTimer) { clearTimeout(saveTimer); await flushSync(); }
    await fbSignOut(auth);
    // Очищуємо local, щоб кошик не лип до наступного юзера на цьому пристрої.
    writeLocal(CART_KEY, []);
    writeLocal(WISH_KEY, []);
    window.dispatchEvent(new CustomEvent('fasco:remote-sync', { detail: { cart: [], wishlist: [] } }));
}

async function updateUserProfile(patch) {
    if (!currentUser) throw new Error('Not authenticated');
    await setDoc(userDoc(currentUser.uid), { profile: { ...patch }, updatedAt: serverTimestamp() }, { merge: true });
    if (patch.firstName || patch.lastName) {
        await updateProfile(currentUser, {
            displayName: `${patch.firstName || ''} ${patch.lastName || ''}`.trim(),
        });
    }
    currentProfile = {
        ...(currentProfile || {}),
        profile: { ...(currentProfile?.profile || {}), ...patch },
    };
    notifyAuthListeners();
}

// === ORDERS ===

async function saveOrder(orderData) {
    const payload = {
        ...orderData,
        userId: currentUser?.uid || null,
        userEmail: currentUser?.email || orderData.email || null,
        createdAt: serverTimestamp(),
        status: 'new',
    };
    return (await addDoc(collection(db, 'orders'), payload)).id;
}

async function listMyOrders() {
    if (!currentUser) return [];
    // Сортуємо на клієнті — щоб не вимагати composite-індекса у Firestore.
    const q = query(collection(db, 'orders'), where('userId', '==', currentUser.uid));
    const snap = await getDocs(q);
    const ts = (v) => {
        if (!v) return 0;
        if (typeof v.toMillis === 'function') return v.toMillis();
        if (v.seconds) return v.seconds * 1000;
        const d = new Date(v);
        return isNaN(d) ? 0 : d.getTime();
    };
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
}

// === STOCK ===
// Колекція `stock/{productId}` = { color: { size: qty } }.

async function getStock(id) {
    const snap = await getDoc(stockDoc(id));
    return snap.exists() ? snap.data() : null;
}

async function getAllStock() {
    const snap = await getDocs(collection(db, 'stock'));
    const map = {};
    snap.forEach(d => { map[d.id] = d.data(); });
    return map;
}

function watchStock(id, cb) {
    return onSnapshot(stockDoc(id), (snap) => cb(snap.exists() ? snap.data() : null));
}

// Атомарне списання stock при оформленні замовлення. Кидає Error із
// зрозумілим текстом, якщо якогось розміру/кольору не вистачає — тоді
// нічого не списується.
async function decrementStock(items) {
    if (!Array.isArray(items) || !items.length) return;
    const map = new Map();
    for (const it of items) {
        const k = `${it.id}::${it.color || ''}::${it.size || ''}`;
        const prev = map.get(k) || { id: it.id, color: it.color || '', size: it.size || '', qty: 0, name: it.name };
        prev.qty += Number(it.qty) || 0;
        map.set(k, prev);
    }
    const grouped = [...map.values()];
    await runTransaction(db, async (tx) => {
        const ids = [...new Set(grouped.map(g => String(g.id)))];
        const refs = ids.map(stockDoc);
        const snaps = await Promise.all(refs.map(r => tx.get(r)));
        const stocks = {};
        ids.forEach((id, i) => { stocks[id] = snaps[i].exists() ? { ...snaps[i].data() } : {}; });
        for (const g of grouped) {
            const have = Number(stocks[String(g.id)]?.[g.color]?.[g.size] || 0);
            if (have < g.qty) {
                const label = g.size === 'ONE' ? 'ONE SIZE' : g.size;
                throw new Error(`${g.name || 'Товар'}${label ? ' (' + label + ')' : ''} — недостатньо в наявності (залишок ${have}).`);
            }
        }
        for (const g of grouped) {
            const stock = stocks[String(g.id)];
            if (!stock[g.color]) stock[g.color] = {};
            stock[g.color][g.size] = Number(stock[g.color][g.size] || 0) - g.qty;
        }
        ids.forEach((id, i) => { tx.set(refs[i], stocks[id], { merge: true }); });
    });
}

// === AUTH STATE ===

onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    if (user) {
        try {
            const data = await syncWithRemote(user);
            currentProfile = data;
            window.dispatchEvent(new CustomEvent('fasco:remote-sync', {
                detail: { cart: data.cart, wishlist: data.wishlist },
            }));
        } catch (e) {
            console.warn('[Fasco] auth sync error', e);
            currentProfile = null;
        }
    } else {
        currentProfile = null;
    }
    notifyAuthListeners();
});

// === PUBLIC API ===

window.FascoApp = {
    get user() { return currentUser; },
    get profile() { return currentProfile; },
    isAuthed: () => !!currentUser,
    onAuthChanged(cb) {
        authListeners.add(cb);
        try { cb(currentUser, currentProfile); } catch { /* ignore */ }
        return () => authListeners.delete(cb);
    },
    signUpWithEmail, signInEmail, signInGoogle, resetPassword, logout,
    updateUserProfile,
    saveOrder, listMyOrders,
    getStock, getAllStock, watchStock, decrementStock,
    notifyCartChanged: scheduleRemoteSync,
    notifyWishlistChanged: scheduleRemoteSync,
};

window.dispatchEvent(new CustomEvent('fasco:ready'));
