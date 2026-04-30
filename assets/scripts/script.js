/* ============================================================
   CART MODULE — localStorage persistence
   ============================================================ */
const Cart = (() => {
    const STORAGE_KEY = 'fasco_cart';
    const FREE_SHIPPING = 75;
    let items = [];

    function load() {
        try { items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
        catch (e) { items = []; }
    }
    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { }
    }
    function getItems() { return items; }
    function getTotalQty() { return items.reduce((s, i) => s + i.qty, 0); }
    function getTotalPrice() { return items.reduce((s, i) => s + i.price * i.qty, 0); }

    function add(product, qty, size, color) {
        const ex = items.find(i => i.id === product.id && i.size === size && i.color === color);
        if (ex) { ex.qty = Math.min(ex.qty + qty, 99); }
        else {
            items.push({
                id: product.id, name: product.name, price: product.price,
                image: (product.images && product.images[0]) || product.image || '',
                size, color, qty: Math.min(qty, 99)
            });
        }
        save(); CartDrawer.render(); CartDrawer.updateBadges();
    }
    function updateQty(index, delta) {
        if (!items[index]) return;
        items[index].qty += delta;
        if (items[index].qty <= 0) items.splice(index, 1);
        save(); CartDrawer.render(); CartDrawer.updateBadges();
    }
    function remove(index) {
        items.splice(index, 1);
        save(); CartDrawer.render(); CartDrawer.updateBadges();
    }
    function getFreeShippingRemaining() { return Math.max(0, FREE_SHIPPING - getTotalPrice()); }
    function getFreeShippingProgress() { return Math.min(100, (getTotalPrice() / FREE_SHIPPING) * 100); }

    load();
    return { getItems, getTotalQty, getTotalPrice, add, updateQty, remove, getFreeShippingRemaining, getFreeShippingProgress };
})();


/* ============================================================
   WISHLIST MODULE — localStorage persistence
   ============================================================ */
const Wishlist = (() => {
    const STORAGE_KEY = 'fasco_wishlist';
    let items = [];

    function load() {
        try { items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
        catch (e) { items = []; }
    }
    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { }
    }
    function getItems() { return items; }
    function getCount() { return items.length; }
    function has(id) { return items.some(i => i.id === id); }

    function toggle(product) {
        const idx = items.findIndex(i => i.id === product.id);
        if (idx >= 0) { items.splice(idx, 1); }
        else {
            items.push({
                id: product.id, name: product.name, price: product.price,
                image: (product.images && product.images[0]) || product.image || '',
                oldPrice: product.oldPrice || null
            });
        }
        save(); WishlistDrawer.render(); WishlistDrawer.updateBadges();
        return has(product.id);
    }

    load();
    return { getItems, getCount, has, toggle };
})();


/* ============================================================
   CART DRAWER
   ============================================================ */
const CartDrawer = (() => {
    const $ = id => document.getElementById(id);

    function open() {
        const d = $('cartDrawer'); if (!d) return;
        d.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function close() {
        const d = $('cartDrawer'); if (!d) return;
        d.classList.remove('open');
        document.body.style.overflow = '';
    }

    function updateBadges() {
        const qty = Cart.getTotalQty();
        const str = qty > 99 ? '99+' : String(qty);
        const badge = $('cartBadge');
        if (badge) { badge.innerText = str; badge.style.display = qty === 0 ? 'none' : 'flex'; }
        const sc = $('stickyCartCount');
        if (sc) { sc.innerText = str; sc.style.display = qty === 0 ? 'none' : 'flex'; }
        const count = $('cartItemsCount');
        if (count) count.innerText = qty;
    }

    function updateShippingBar() {
        const remaining = Cart.getFreeShippingRemaining();
        const pct = Cart.getFreeShippingProgress();
        const fill = $('shippingProgressFill');
        if (fill) fill.style.width = pct + '%';
        const text = $('cartShippingText');
        if (text) {
            text.innerHTML = remaining <= 0
                ? '<strong>🎉 Безкоштовна доставка розблокована!</strong>'
                : `Додайте ще <strong>$${remaining.toFixed(2)}</strong> для <strong>безкоштовної доставки!</strong>`;
        }
        // Оновлюємо вартість доставки в підсумку
        const shippingCostEl = $('cartShippingCost');
        if (shippingCostEl) {
            shippingCostEl.innerHTML = remaining <= 0
                ? '<strong>$0.00</strong>'
                : 'Розраховується при оформленні';
            const row = shippingCostEl.closest('.cart-total-row');
            if (row) row.classList.toggle('cart-total-row--muted', remaining > 0);
        }
    }

    function render() {
        const list = $('cartDrawerItems');
        if (!list) return;
        list.querySelectorAll('.cart-item').forEach(el => el.remove());
        const cartItems = Cart.getItems();
        const isEmpty = cartItems.length === 0;
        const emptyEl = $('cartEmpty');
        const footerEl = $('cartDrawerFooter');
        if (emptyEl) emptyEl.style.display = isEmpty ? 'flex' : 'none';
        if (footerEl) footerEl.style.display = isEmpty ? 'none' : 'flex';
        if (isEmpty) return;

        cartItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'cart-item';
            const colorSwatch = item.color && item.color.startsWith('#')
                ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${item.color};border:1px solid #ddd;vertical-align:middle;"></span>` : '';
            div.innerHTML = `
                <img class="cart-item-img" src="${item.image}" alt="${item.name}" onerror="this.style.background='#f5f5f5'">
                <div class="cart-item-info">
                    <p class="cart-item-brand">FASCO</p>
                    <p class="cart-item-name">${item.name}</p>
                    <div class="cart-item-meta">
                        ${item.size ? `<span>Розмір: ${item.size}</span>` : ''}
                        ${colorSwatch}
                    </div>
                    <div class="cart-item-bottom">
                        <span class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</span>
                        <div class="cart-item-qty">
                            <button class="ci-minus" data-idx="${index}">−</button>
                            <span class="cart-item-qty-num">${item.qty}</span>
                            <button class="ci-plus" data-idx="${index}">+</button>
                        </div>
                    </div>
                </div>
                <button class="cart-item-remove" data-idx="${index}"><i class="fa-solid fa-xmark"></i></button>`;
            list.appendChild(div);
        });

        const sub = $('cartSubtotal');
        if (sub) sub.innerText = `$${Cart.getTotalPrice().toFixed(2)}`;
        updateShippingBar();

        list.querySelectorAll('.ci-minus').forEach(btn => btn.addEventListener('click', () => Cart.updateQty(+btn.dataset.idx, -1)));
        list.querySelectorAll('.ci-plus').forEach(btn => btn.addEventListener('click', () => Cart.updateQty(+btn.dataset.idx, 1)));
        list.querySelectorAll('.cart-item-remove').forEach(btn => btn.addEventListener('click', () => Cart.remove(+btn.dataset.idx)));
    }

    function init() {
        document.addEventListener('DOMContentLoaded', () => {
            const overlay = $('cartDrawerOverlay');
            const closeBtn = $('cartDrawerClose');
            const continueBtn = $('continueShoppingBtn');
            const stickyLink = $('stickyCartLink');

            if (overlay) overlay.addEventListener('click', close);
            if (closeBtn) closeBtn.addEventListener('click', close);
            if (continueBtn) continueBtn.addEventListener('click', close);
            // Sticky cart button opens drawer
            if (stickyLink) stickyLink.addEventListener('click', e => { e.preventDefault(); open(); });

            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && $('cartDrawer')?.classList.contains('open')) close();
            });

            render();
            updateBadges();

            // PDP: Add to cart
            const addBtn = $('addToCartBtn');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    const product = window._currentProduct;
                    if (!product) return;
                    const qty = parseInt($('qty-value')?.value || 1);
                    const size = $('selected-size-text')?.innerText?.trim() || 'M';
                    const rawColor = $('selected-color-text')?.innerText?.trim() || '';
                    const color = rawColor === '—' ? '' : rawColor;
                    const origHTML = addBtn.innerHTML;
                    addBtn.classList.add('added');
                    addBtn.innerHTML = '<i class="fa-solid fa-check"></i> Додано!';
                    setTimeout(() => { addBtn.classList.remove('added'); addBtn.innerHTML = origHTML; }, 1500);
                    Cart.add(product, qty, size, color);
                    open();
                });
            }
        });
    }
    return { init, open, close, render, updateBadges };
})();
CartDrawer.init();


/* ============================================================
   WISHLIST DRAWER
   ============================================================ */
const WishlistDrawer = (() => {
    const $ = id => document.getElementById(id);

    function open() {
        const d = $('wishlistDrawer'); if (!d) return;
        d.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function close() {
        const d = $('wishlistDrawer'); if (!d) return;
        d.classList.remove('open');
        document.body.style.overflow = '';
    }

    function updateBadges() {
        const count = Wishlist.getCount();
        const badge = $('wishlistBadge');
        if (badge) { badge.innerText = count; badge.style.display = count === 0 ? 'none' : 'flex'; }
        const countEl = $('wishlistItemsCount');
        if (countEl) countEl.innerText = count;
    }

    function render() {
        const list = $('wishlistDrawerItems');
        if (!list) return;
        list.querySelectorAll('.wishlist-item').forEach(el => el.remove());
        const items = Wishlist.getItems();
        const isEmpty = items.length === 0;
        const emptyEl = $('wishlistEmpty');
        if (emptyEl) emptyEl.style.display = isEmpty ? 'flex' : 'none';
        if (isEmpty) return;

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'wishlist-item';
            const oldPriceHTML = item.oldPrice ? `<span class="wishlist-item-old-price">$${item.oldPrice.toFixed(2)}</span>` : '';
            div.innerHTML = `
                <a href="product.html?id=${item.id}" class="wishlist-item-link">
                    <img class="wishlist-item-img" src="${item.image}" alt="${item.name}" onerror="this.style.background='#f5f5f5'">
                    <div class="wishlist-item-info">
                        <p class="wishlist-item-brand">FASCO</p>
                        <p class="wishlist-item-name">${item.name}</p>
                        <div class="wishlist-item-prices">
                            <span class="wishlist-item-price">$${item.price.toFixed(2)}</span>
                            ${oldPriceHTML}
                        </div>
                    </div>
                </a>
                <button class="wishlist-item-remove" data-id="${item.id}" title="Видалити">
                    <i class="fa-solid fa-xmark"></i>
                </button>`;
            list.appendChild(div);
        });

        list.querySelectorAll('.wishlist-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const product = Wishlist.getItems().find(i => i.id === id);
                if (product) {
                    Wishlist.toggle(product);
                    // Sync any heart buttons on page
                    document.querySelectorAll(`[data-wishlist-id="${id}"]`).forEach(heartBtn => {
                        heartBtn.classList.remove('active');
                        const icon = heartBtn.querySelector('i');
                        if (icon) icon.className = 'fa-regular fa-heart';
                    });
                }
            });
        });
    }

    function syncBtn(btn, productId) {
        if (!btn) return;
        const isWishlisted = Wishlist.has(productId);
        btn.classList.toggle('active', isWishlisted);
        const icon = btn.querySelector('i');
        if (icon) icon.className = isWishlisted ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    }

    function init() {
        document.addEventListener('DOMContentLoaded', () => {
            const toggleBtn = $('wishlistToggleBtn');
            const overlay = $('wishlistDrawerOverlay');
            const closeBtn = $('wishlistDrawerClose');
            const mobileWishBtn = $('mobileWishlistBtn');

            if (toggleBtn) toggleBtn.addEventListener('click', e => { e.preventDefault(); open(); });
            if (mobileWishBtn) mobileWishBtn.addEventListener('click', e => { e.preventDefault(); open(); });
            if (overlay) overlay.addEventListener('click', close);
            if (closeBtn) closeBtn.addEventListener('click', close);
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && $('wishlistDrawer')?.classList.contains('open')) close();
            });

            render();
            updateBadges();
        });
    }

    return { init, open, close, render, updateBadges, syncBtn };
})();
WishlistDrawer.init();


/* ============================================================
   SEARCH OVERLAY
   ============================================================ */
const SearchOverlay = (() => {
    let allProducts = [];
    let isLoaded = false;

    async function loadProducts() {
        if (isLoaded) return;
        try {
            const r = await fetch('./assets/data/products.json');
            allProducts = await r.json();
            isLoaded = true;
        } catch (e) { console.warn('Search: could not load products'); }
    }

    function highlight(text, query) {
        if (!query) return text;
        return text.replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
    }

    function renderResults(query) {
        const grid = document.getElementById('searchResultsGrid');
        const hint = document.getElementById('searchHint');
        if (!grid) return;
        if (!query) { grid.innerHTML = ''; if (hint) hint.style.display = 'block'; return; }
        if (hint) hint.style.display = 'none';
        const matches = allProducts.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
        if (matches.length === 0) {
            grid.innerHTML = `<p class="search-no-results">Нічого не знайдено за запитом "<strong>${query}</strong>"</p>`;
            return;
        }
        const countEl = document.createElement('p');
        countEl.className = 'search-results-count';
        countEl.innerText = `Знайдено: ${matches.length} товар${matches.length === 1 ? '' : matches.length < 5 ? 'и' : 'ів'}`;
        grid.innerHTML = '';
        grid.appendChild(countEl);
        matches.slice(0, 8).forEach(p => {
            const a = document.createElement('a');
            a.className = 'search-result-item';
            a.href = `product.html?id=${p.id}`;
            a.innerHTML = `
                <img class="search-result-img" src="${p.image}" alt="${p.name}" onerror="this.style.background='#f5f5f5'">
                <div class="search-result-info">
                    <p class="search-result-name">${highlight(p.name, query)}</p>
                    <p class="search-result-price">$${p.price.toFixed(2)}${p.oldPrice ? ` <span class="old">$${p.oldPrice.toFixed(2)}</span>` : ''}</p>
                </div>
                <i class="fa-solid fa-chevron-right" style="color:#ccc;font-size:12px;flex-shrink:0;"></i>`;
            grid.appendChild(a);
        });
        if (window._shopFilterBySearch) window._shopFilterBySearch(query);
    }

    function open() {
        const overlay = document.getElementById('searchOverlay');
        const input = document.getElementById('searchInput');
        if (!overlay) return;
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        loadProducts();
        setTimeout(() => input && input.focus(), 100);
    }

    function close() {
        const overlay = document.getElementById('searchOverlay');
        if (!overlay) return;
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        const input = document.getElementById('searchInput');
        if (input) input.value = '';
        const grid = document.getElementById('searchResultsGrid');
        if (grid) grid.innerHTML = '';
        const hint = document.getElementById('searchHint');
        if (hint) hint.style.display = 'block';
    }

    function init() {
        document.addEventListener('DOMContentLoaded', () => {
            const toggleBtn = document.getElementById('searchToggleBtn');
            const mobileSearchBtn = document.getElementById('mobileSearchBtn');
            const closeBtn = document.getElementById('searchClose');
            const overlay = document.getElementById('searchOverlay');
            const input = document.getElementById('searchInput');

            if (toggleBtn) toggleBtn.addEventListener('click', e => { e.preventDefault(); open(); });
            if (mobileSearchBtn) mobileSearchBtn.addEventListener('click', e => { e.preventDefault(); open(); });
            if (closeBtn) closeBtn.addEventListener('click', close);
            if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
            if (input) {
                let timer;
                input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => renderResults(input.value.trim()), 180); });
            }
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay?.classList.contains('open')) close(); });
        });
    }
    return { init, open, close };
})();
SearchOverlay.init();


/* ============================================================
   1. PAGE LOADER
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('pageLoader');
    if (!loader) return;
    const hide = () => loader.classList.add('hidden');
    if (document.readyState === 'complete') { hide(); }
    else { window.addEventListener('load', hide); setTimeout(hide, 1200); }
});


/* ============================================================
   2. MOBILE MENU — body-level panel (no transform conflict)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const burgerBtn = document.getElementById('burgerMenu');
    const openIcon = document.getElementById('openIcon');
    const closeIcon = document.getElementById('closeIcon');
    // Panel is now a direct child of body, NOT inside nav
    const panel = document.getElementById('mobileMenuPanel');
    const overlay = document.getElementById('mobileMenuOverlay');
    const closeBtn = document.getElementById('mobileMenuClose');

    if (!burgerBtn || !panel) return;

    function openMenu() {
        panel.classList.add('open');
        if (overlay) overlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
        if (openIcon) openIcon.classList.add('d-none');
        if (closeIcon) closeIcon.classList.remove('d-none');
    }

    function closeMenu() {
        panel.classList.remove('open');
        if (overlay) overlay.classList.remove('visible');
        document.body.style.overflow = '';
        if (openIcon) openIcon.classList.remove('d-none');
        if (closeIcon) closeIcon.classList.add('d-none');
    }

    burgerBtn.addEventListener('click', () => {
        panel.classList.contains('open') ? closeMenu() : openMenu();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && panel.classList.contains('open')) closeMenu();
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024 && panel.classList.contains('open')) closeMenu();
    });
});


/* ============================================================
   3. SCROLL TO TOP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('scrollToTop');
    if (btn) btn.addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
});


/* ============================================================
   4. INFO MODALS (Support / Payment / Contacts / Careers / Blog / FAQ)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const MODALS = {
        myModal: `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h2 class="font-title">Напишіть нам</h2>
                <p class="regular-text">Маєте запитання? Заповніть форму, і ми зв'яжемося з вами!</p>
                <form class="modal-form">
                    <input type="text" placeholder="Ваше ім'я" required>
                    <input type="email" placeholder="Ваш Email" required>
                    <textarea placeholder="Ваше повідомлення" rows="4" required></textarea>
                    <button type="submit" class="btn btn-modal">Надіслати</button>
                </form>
            </div>`,

        paymentModal: `
            <div class="modal-content modal-content-info">
                <span class="close-modal">&times;</span>
                <h2 class="font-title">Оплата</h2>
                <p class="regular-text">Зручні та безпечні способи оплати у FASCO.</p>
                <ul class="modal-info-list">
                    <li><i class="fa-regular fa-credit-card"></i><div><strong>Картки:</strong> Visa, MasterCard, American Express</div></li>
                    <li><i class="fa-brands fa-apple-pay"></i><div><strong>Електронні гаманці:</strong> Apple Pay, Google Pay</div></li>
                    <li><i class="fa-solid fa-money-bill-wave"></i><div><strong>Готівкою при отриманні</strong> — у межах України</div></li>
                    <li><i class="fa-solid fa-shield-halved"></i><div><strong>Безпека:</strong> 256-біт SSL шифрування. Ми не зберігаємо реквізити карти</div></li>
                    <li><i class="fa-solid fa-rotate-left"></i><div><strong>Повернення коштів:</strong> 5–7 робочих днів після підтвердження</div></li>
                </ul>
            </div>`,

        contactsModal: `
            <div class="modal-content modal-content-info">
                <span class="close-modal">&times;</span>
                <h2 class="font-title">Контакти</h2>
                <p class="regular-text">Маєте запитання? Ми завжди на зв'язку.</p>
                <ul class="modal-info-list">
                    <li><i class="fa-regular fa-envelope"></i><div><strong>Email:</strong> <a href="mailto:support@fasco.com">support@fasco.com</a></div></li>
                    <li><i class="fa-solid fa-phone"></i><div><strong>Телефон:</strong> <a href="tel:+380441234567">+380 (44) 123-45-67</a></div></li>
                    <li><i class="fa-solid fa-location-dot"></i><div><strong>Адреса:</strong> м. Київ, вул. Хрещатик, 22</div></li>
                    <li><i class="fa-regular fa-clock"></i><div><strong>Графік:</strong> Пн–Пт 9:00–20:00<br>Сб–Нд 10:00–18:00</div></li>
                </ul>
                <div class="modal-socials">
                    <a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
                    <a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook"></i></a>
                    <a href="#" aria-label="Telegram"><i class="fa-brands fa-telegram"></i></a>
                    <a href="#" aria-label="TikTok"><i class="fa-brands fa-tiktok"></i></a>
                </div>
            </div>`,

        careersModal: `
            <div class="modal-content modal-content-info">
                <span class="close-modal">&times;</span>
                <h2 class="font-title">Кар'єра у FASCO</h2>
                <p class="regular-text">Будуй з нами історію fashion-бренду нового покоління.</p>
                <h3 class="modal-subhead">Поточні вакансії</h3>
                <ul class="modal-info-list">
                    <li><i class="fa-solid fa-briefcase"></i><div><strong>Менеджер магазину</strong> — Київ, повна зайнятість</div></li>
                    <li><i class="fa-solid fa-pen"></i><div><strong>Контент-мейкер</strong> — віддалено</div></li>
                    <li><i class="fa-solid fa-camera"></i><div><strong>Фотограф для лукбуків</strong> — Київ, проєктна робота</div></li>
                    <li><i class="fa-solid fa-shirt"></i><div><strong>Стиліст-консультант</strong> — онлайн, гнучкий графік</div></li>
                </ul>
                <h3 class="modal-subhead">Чому ми</h3>
                <p class="regular-text modal-info-text">30% знижка на одяг бренду · Навчання та воркшопи · Дружня команда · Гнучкий графік</p>
                <p class="regular-text modal-info-text">Надсилайте резюме на <a href="mailto:hr@fasco.com">hr@fasco.com</a></p>
            </div>`,

        blogModal: `
            <div class="modal-content modal-content-info">
                <span class="close-modal">&times;</span>
                <h2 class="font-title">Блог FASCO</h2>
                <p class="regular-text">Останні новини, гайди та натхнення зі світу моди.</p>
                <ul class="modal-blog-list">
                    <li>
                        <span class="blog-date">14 жовтня 2025</span>
                        <h4>Як зібрати капсульний гардероб на осінь</h4>
                        <p>10 базових речей, які поєднуються між собою і створюють понад 20 образів.</p>
                    </li>
                    <li>
                        <span class="blog-date">1 жовтня 2025</span>
                        <h4>5 трендів сезону: що носити цієї осені</h4>
                        <p>Від оверсайз-пальт до металевих тканин — головні напрямки сезону.</p>
                    </li>
                    <li>
                        <span class="blog-date">18 вересня 2025</span>
                        <h4>Догляд за делікатними тканинами</h4>
                        <p>Міні-гайд, як зберегти улюблені речі у бездоганному вигляді надовго.</p>
                    </li>
                </ul>
                <p class="regular-text modal-info-text modal-info-muted">Скоро тут буде повноцінний блог. Слідкуйте за оновленнями!</p>
            </div>`,

        faqModal: `
            <div class="modal-content modal-content-info modal-content-large">
                <span class="close-modal">&times;</span>
                <h2 class="font-title">Часті запитання</h2>
                <p class="regular-text">Усе, що ви хотіли знати про покупки у FASCO.</p>
                <div class="modal-faq">
                    <div class="faq-item">
                        <button type="button" class="faq-q">Як здійснити замовлення?</button>
                        <div class="faq-a"><p>Виберіть товар → натисніть «Додати в кошик» → перейдіть до оформлення → заповніть дані доставки → виберіть спосіб оплати → підтвердьте замовлення.</p></div>
                    </div>
                    <div class="faq-item">
                        <button type="button" class="faq-q">Скільки триває доставка?</button>
                        <div class="faq-a"><p>Зазвичай 1–3 робочі дні Новою Поштою по Україні. Безкоштовна доставка від $75. У випадку індивідуального пошиття — до 7 днів.</p></div>
                    </div>
                    <div class="faq-item">
                        <button type="button" class="faq-q">Чи можна повернути товар?</button>
                        <div class="faq-a"><p>Так, протягом 14 днів з моменту отримання. Товар має бути неношений, з оригінальними бирками та в фірмовій упаковці.</p></div>
                    </div>
                    <div class="faq-item">
                        <button type="button" class="faq-q">Як підібрати правильний розмір?</button>
                        <div class="faq-a"><p>На сторінці кожного товару є таблиця розмірів. Якщо сумніваєтесь — напишіть нашому стилісту через форму підтримки, ми допоможемо обрати.</p></div>
                    </div>
                    <div class="faq-item">
                        <button type="button" class="faq-q">Як змінити або скасувати замовлення?</button>
                        <div class="faq-a"><p>Зверніться до підтримки протягом 30 хвилин після оформлення. Після передачі замовлення на склад зміни неможливі — лише повернення після отримання.</p></div>
                    </div>
                    <div class="faq-item">
                        <button type="button" class="faq-q">Чи маєте ви офлайн-магазин?</button>
                        <div class="faq-a"><p>Так, наш брендовий магазин розташований у Києві: вул. Хрещатик, 22. Графік: Пн–Пт 9:00–20:00, Сб–Нд 10:00–18:00.</p></div>
                    </div>
                    <div class="faq-item">
                        <button type="button" class="faq-q">Які способи оплати ви приймаєте?</button>
                        <div class="faq-a"><p>Visa, MasterCard, American Express, Apple Pay, Google Pay та готівкою при отриманні (тільки в межах України). Усі платежі захищені SSL.</p></div>
                    </div>
                </div>
            </div>`
    };

    if (document.querySelector('.footer-nav')) {
        Object.entries(MODALS).forEach(([id, html]) => {
            if (document.getElementById(id)) return;
            const el = document.createElement('div');
            el.id = id;
            el.className = 'modal-overlay';
            el.innerHTML = html;
            document.body.appendChild(el);
        });
    }

    function closeModal(modal) {
        modal.classList.remove('open'); modal.classList.add('close');
        setTimeout(() => modal.classList.remove('close'), 400);
        document.body.style.overflow = '';
    }
    function openModal(modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    document.addEventListener('click', e => {
        const trigger = e.target.closest('[data-modal-target]');
        if (trigger) {
            e.preventDefault();
            const modal = document.getElementById(trigger.dataset.modalTarget);
            if (modal) openModal(modal);
            return;
        }
        const legacy = e.target.closest('#supportBtn');
        if (legacy) {
            e.preventDefault();
            const modal = document.getElementById('myModal');
            if (modal) openModal(modal);
            return;
        }
        if (e.target.classList.contains('close-modal')) {
            const modal = e.target.closest('.modal-overlay');
            if (modal) closeModal(modal);
            return;
        }
        // FAQ accordion toggle
        const faqQ = e.target.closest('.faq-q');
        if (faqQ) {
            e.preventDefault();
            faqQ.parentElement.classList.toggle('open');
            return;
        }
        if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('open')) {
            closeModal(e.target);
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const open = document.querySelector('.modal-overlay.open');
        if (open) closeModal(open);
    });
});


/* ============================================================
   5. CAROUSEL
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.querySelector('.reviews-wrapper .carousel');
    if (!carousel) return;
    const cards = document.querySelectorAll('.review-card');
    const prevBtn = document.querySelector('.reviews .nav-btn.prev');
    const nextBtn = document.querySelector('.reviews .nav-btn.next');
    if (!cards.length || !prevBtn || !nextBtn) return;
    let idx = 1;
    const total = cards.length;
    function update() {
        cards.forEach((c, i) => {
            c.classList.remove('active', 'prev', 'next'); c.style.display = 'flex';
            const pos = (i - idx + total) % total;
            if (pos === 0) c.classList.add('active');
            else if (pos === 1) c.classList.add('next');
            else if (pos === total - 1) c.classList.add('prev');
            else c.style.display = 'none';
        });
    }
    nextBtn.addEventListener('click', () => { idx = (idx + 1) % total; update(); });
    prevBtn.addEventListener('click', () => { idx = (idx - 1 + total) % total; update(); });
    update();
});


/* ============================================================
   6. SHOP PAGE — products + filters + wishlist on cards
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('product-grid');
    const sortSelect = document.getElementById('sort');
    const paginationContainer = document.getElementById('pagination-container');
    const viewOptions = document.querySelector('.view-options');
    if (!productGrid || !sortSelect || !paginationContainer || !viewOptions) return;

    let allProducts = [], currentPage = 1, itemsPerPage = 9, currentLayout = 'grid-3';
    let activeFilters = { sizes: [], colors: [], priceMin: null, priceMax: null, collection: 'all' };
    let searchQuery = '';

    // Read ?collection=xxx from URL for deep links from index/footer/etc
    const urlCollection = new URLSearchParams(location.search).get('collection');
    if (urlCollection) {
        const link = document.querySelector(`#collectionList a[data-collection="${urlCollection}"]`);
        if (link) {
            activeFilters.collection = urlCollection;
            document.querySelectorAll('#collectionList a').forEach(a => a.classList.remove('active-collection'));
            link.classList.add('active-collection');
        }
    }

    const collectionLabels = {
        all: 'Всі товари',
        exclusive: 'Ексклюзивна колекція',
        'spring-sale': 'Весняний розпродаж',
        summer: 'Літня колекція',
        accessories: 'Аксесуари'
    };

    window._shopFilterBySearch = q => { searchQuery = q.toLowerCase(); currentPage = 1; renderPage(); };

    async function loadProducts() {
        try {
            const r = await fetch('./assets/data/products.json');
            if (!r.ok) throw new Error();
            allProducts = await r.json();
            renderPage();
        } catch (e) {
            productGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px;color:#aaa;">Помилка завантаження.</p>';
        }
    }

    function applyFilters(products) {
        return products.filter(p => {
            if (activeFilters.collection !== 'all' && !(p.collections || []).includes(activeFilters.collection)) return false;
            if (activeFilters.priceMin !== null && p.price < activeFilters.priceMin) return false;
            if (activeFilters.priceMax !== null && p.price > activeFilters.priceMax) return false;
            if (activeFilters.colors.length > 0) {
                const ok = activeFilters.colors.some(c => (p.swatches || []).some(s => s.toLowerCase() === c.toLowerCase()));
                if (!ok) return false;
            }
            if (searchQuery && !p.name.toLowerCase().includes(searchQuery)) return false;
            return true;
        });
    }

    function renderPage() {
        let products = applyFilters([...allProducts]);
        if (sortSelect.value === 'price-asc') products.sort((a, b) => a.price - b.price);
        else if (sortSelect.value === 'price-desc') products.sort((a, b) => b.price - a.price);
        const start = (currentPage - 1) * itemsPerPage;
        displayProducts(products.slice(start, start + itemsPerPage), products.length === 0);
        setupPagination(products.length);
        productGrid.className = 'product-grid layout-' + currentLayout;
        renderActiveFilterTags();
        updateFilterResetBtn();
    }

    function displayProducts(products, isEmpty) {
        productGrid.innerHTML = '';
        if (isEmpty) {
            productGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#aaa;">
                <i class="fa-solid fa-magnifying-glass" style="font-size:28px;display:block;margin-bottom:12px;opacity:.3;"></i>
                Товарів за вашими фільтрами не знайдено.</div>`;
            return;
        }
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            const swatchesHTML = (product.swatches || []).map(c => `<span class="swatch" style="background:${c};" title="${c}"></span>`).join('');
            const oldPriceHTML = product.oldPrice ? `<span class="old-price">$${product.oldPrice.toFixed(2)}</span>` : '';
            const saleBadge = product.oldPrice ? `<span class="sale-badge-small">Sale</span>` : '';
            const defaultImg = (product.images && product.images[0]) || product.image || '';
            const hoverImg = (product.images && (product.images[3] || product.images[1])) || defaultImg;
            const isWishlisted = Wishlist.has(product.id);

            card.innerHTML = `
                <div class="product-image-wrapper">
                    <a href="product.html?id=${product.id}" class="product-link">
                        <img class="img-default" src="${defaultImg}" alt="${product.name}" loading="lazy">
                        <img class="img-hover" src="${hoverImg}" alt="${product.name}" loading="lazy">
                        ${saleBadge}
                    </a>
                    <button class="card-wishlist-btn ${isWishlisted ? 'active' : ''}" data-wishlist-id="${product.id}" aria-label="Обране">
                        <i class="${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                </div>
                <a href="product.html?id=${product.id}" class="product-link">
                    <div class="product-info">
                        <h4>${product.name}</h4>
                        <div class="price-wrapper"><span class="price">$${product.price.toFixed(2)}</span>${oldPriceHTML}</div>
                        <div class="swatches">${swatchesHTML}</div>
                    </div>
                </a>`;

            card.querySelector('.card-wishlist-btn').addEventListener('click', function () {
                const isNow = Wishlist.toggle(product);
                this.classList.toggle('active', isNow);
                const icon = this.querySelector('i');
                if (icon) icon.className = isNow ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
            });

            productGrid.appendChild(card);
        });
    }

    function setupPagination(total) {
        paginationContainer.innerHTML = '';
        const totalPages = Math.ceil(total / itemsPerPage);
        if (totalPages <= 1) return;
        const pages = [];
        if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
        else {
            pages.push(1);
            if (currentPage > 2) pages.push('...');
            let s = Math.max(2, currentPage - 1), e = Math.min(totalPages - 1, currentPage + 1);
            if (currentPage === 1) e = 3;
            if (currentPage === totalPages) s = totalPages - 2;
            for (let i = s; i <= e; i++) if (!pages.includes(i)) pages.push(i);
            if (currentPage < totalPages - 1) pages.push('...');
            pages.push(totalPages);
        }
        pages.forEach(page => {
            if (page === '...') {
                const s = document.createElement('span'); s.innerText = '...'; paginationContainer.appendChild(s);
            } else {
                const a = document.createElement('a'); a.innerText = page; a.dataset.page = page;
                if (page === currentPage) a.classList.add('active');
                a.addEventListener('click', e => { e.preventDefault(); currentPage = +e.target.dataset.page; renderPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
                paginationContainer.appendChild(a);
            }
        });
        if (currentPage < totalPages) {
            const next = document.createElement('a'); next.innerText = '»'; next.dataset.page = currentPage + 1;
            next.addEventListener('click', e => { e.preventDefault(); currentPage = +e.target.dataset.page; renderPage(); });
            paginationContainer.appendChild(next);
        }
    }

    // Filters
    document.querySelectorAll('.size-box[data-size]').forEach(box => {
        box.addEventListener('click', () => {
            const size = box.dataset.size;
            box.classList.toggle('active');
            if (box.classList.contains('active')) activeFilters.sizes.push(size);
            else activeFilters.sizes = activeFilters.sizes.filter(s => s !== size);
            currentPage = 1; renderPage();
        });
    });

    document.querySelectorAll('.color-dot[data-color]').forEach(dot => {
        dot.addEventListener('click', () => {
            const color = dot.dataset.color;
            dot.classList.toggle('active');
            if (dot.classList.contains('active')) activeFilters.colors.push(color);
            else activeFilters.colors = activeFilters.colors.filter(c => c !== color);
            currentPage = 1; renderPage();
        });
    });

    document.querySelectorAll('.filter-group a[data-price-min]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const min = parseFloat(link.dataset.priceMin), max = parseFloat(link.dataset.priceMax);
            if (activeFilters.priceMin === min && activeFilters.priceMax === max) {
                activeFilters.priceMin = null; activeFilters.priceMax = null;
                link.parentElement.classList.remove('active-price');
            } else {
                activeFilters.priceMin = min; activeFilters.priceMax = max;
                document.querySelectorAll('.filter-group li.active-price').forEach(li => li.classList.remove('active-price'));
                link.parentElement.classList.add('active-price');
            }
            currentPage = 1; renderPage();
        });
    });

    document.querySelectorAll('.filter-group.collapsible .filter-group-header').forEach(header => {
        header.addEventListener('click', () => header.closest('.filter-group.collapsible')?.classList.toggle('closed'));
    });

    // Collection filter (single-select)
    document.querySelectorAll('#collectionList a[data-collection]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const col = link.dataset.collection;
            activeFilters.collection = col;
            document.querySelectorAll('#collectionList a').forEach(a => a.classList.remove('active-collection'));
            link.classList.add('active-collection');
            // sync URL without page reload
            const url = new URL(location.href);
            if (col === 'all') url.searchParams.delete('collection');
            else url.searchParams.set('collection', col);
            history.replaceState(null, '', url);
            currentPage = 1;
            renderPage();
        });
    });

    function renderActiveFilterTags() {
        let bar = document.getElementById('activeFiltersBar');
        if (!bar) { bar = document.createElement('div'); bar.id = 'activeFiltersBar'; bar.className = 'active-filters-bar'; productGrid.before(bar); }
        bar.innerHTML = '';
        if (!activeFilters.colors.length && !activeFilters.sizes.length && activeFilters.priceMin === null && !searchQuery && activeFilters.collection === 'all') return;
        if (activeFilters.collection !== 'all') {
            const t = document.createElement('span'); t.className = 'active-filter-tag';
            t.innerHTML = `${collectionLabels[activeFilters.collection] || activeFilters.collection} <i class="fa-solid fa-xmark"></i>`;
            t.addEventListener('click', () => {
                activeFilters.collection = 'all';
                document.querySelectorAll('#collectionList a').forEach(a => a.classList.remove('active-collection'));
                document.querySelector('#collectionList a[data-collection="all"]')?.classList.add('active-collection');
                const url = new URL(location.href); url.searchParams.delete('collection'); history.replaceState(null, '', url);
                currentPage = 1; renderPage();
            });
            bar.appendChild(t);
        }
        if (activeFilters.priceMin !== null) {
            const t = document.createElement('span'); t.className = 'active-filter-tag';
            t.innerHTML = `$${activeFilters.priceMin}–$${activeFilters.priceMax} <i class="fa-solid fa-xmark"></i>`;
            t.addEventListener('click', () => { activeFilters.priceMin = null; activeFilters.priceMax = null; document.querySelectorAll('.filter-group li.active-price').forEach(li => li.classList.remove('active-price')); currentPage = 1; renderPage(); });
            bar.appendChild(t);
        }
        activeFilters.sizes.forEach(size => {
            const t = document.createElement('span'); t.className = 'active-filter-tag';
            t.innerHTML = `${size} <i class="fa-solid fa-xmark"></i>`;
            t.addEventListener('click', () => { activeFilters.sizes = activeFilters.sizes.filter(s => s !== size); document.querySelector(`.size-box[data-size="${size}"]`)?.classList.remove('active'); currentPage = 1; renderPage(); });
            bar.appendChild(t);
        });
        activeFilters.colors.forEach(color => {
            const t = document.createElement('span'); t.className = 'active-filter-tag';
            t.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:4px;border:1px solid #ddd;vertical-align:middle;"></span>Колір <i class="fa-solid fa-xmark"></i>`;
            t.addEventListener('click', () => { activeFilters.colors = activeFilters.colors.filter(c => c !== color); document.querySelector(`.color-dot[data-color="${color}"]`)?.classList.remove('active'); currentPage = 1; renderPage(); });
            bar.appendChild(t);
        });
        if (searchQuery) {
            const t = document.createElement('span'); t.className = 'active-filter-tag';
            t.innerHTML = `"${searchQuery}" <i class="fa-solid fa-xmark"></i>`;
            t.addEventListener('click', () => { searchQuery = ''; const input = document.getElementById('searchInput'); if (input) input.value = ''; currentPage = 1; renderPage(); });
            bar.appendChild(t);
        }
    }

    function updateFilterResetBtn() {
        let btn = document.getElementById('filterResetBtn');
        if (!btn) {
            const sidebar = document.querySelector('.shop-sidebar');
            if (!sidebar) return;
            btn = document.createElement('button'); btn.id = 'filterResetBtn'; btn.className = 'filter-reset-btn';
            btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Скинути фільтри';
            sidebar.appendChild(btn);
            btn.addEventListener('click', () => {
                activeFilters = { sizes: [], colors: [], priceMin: null, priceMax: null, collection: 'all' }; searchQuery = '';
                document.querySelectorAll('.size-box.active').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.color-dot.active').forEach(d => d.classList.remove('active'));
                document.querySelectorAll('.filter-group li.active-price').forEach(li => li.classList.remove('active-price'));
                document.querySelectorAll('#collectionList a').forEach(a => a.classList.remove('active-collection'));
                document.querySelector('#collectionList a[data-collection="all"]')?.classList.add('active-collection');
                const url = new URL(location.href); url.searchParams.delete('collection'); history.replaceState(null, '', url);
                currentPage = 1; renderPage();
            });
        }
        btn.classList.toggle('visible', !!(activeFilters.sizes.length || activeFilters.colors.length || activeFilters.priceMin !== null || searchQuery || activeFilters.collection !== 'all'));
    }

    sortSelect.addEventListener('change', () => { currentPage = 1; renderPage(); });
    viewOptions.addEventListener('click', e => {
        const btn = e.target.closest('.view-btn');
        if (!btn) return;
        const layout = btn.dataset.layout, items = btn.dataset.items;
        if (!layout || layout === currentLayout) return;
        currentLayout = layout; itemsPerPage = +items; currentPage = 1;
        viewOptions.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderPage();
    });

    loadProducts();
});


/* ============================================================
   7. PRODUCT PAGE (PDP)
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    const productTitleEl = document.getElementById('product-title');
    if (!productTitleEl) return;

    const pageLoader = document.getElementById('pageLoader');
    const hideLoader = () => { if (pageLoader) pageLoader.classList.add('hidden'); };

    const productId = parseInt(new URLSearchParams(window.location.search).get('id'));
    if (!productId) { productTitleEl.innerText = 'Оберіть товар у магазині'; hideLoader(); return; }

    try {
        const res = await fetch('./assets/data/products.json');
        const products = await res.json();
        const product = products.find(p => p.id === productId);
        if (!product) { productTitleEl.innerText = 'Товар не знайдено'; hideLoader(); return; }

        document.title = `${product.name} - FASCO`;
        document.getElementById('breadcrumb-name').innerText = product.name;
        productTitleEl.innerText = product.name;
        document.getElementById('product-price').innerText = `$${product.price.toFixed(2)}`;

        const descEl = document.getElementById('product-description-text');
        if (descEl && product.description) descEl.innerText = product.description;

        if (product.oldPrice) {
            const opEl = document.getElementById('product-old-price');
            const sbEl = document.getElementById('product-sale-badge');
            if (opEl) opEl.innerText = `$${product.oldPrice.toFixed(2)}`;
            if (sbEl) { sbEl.innerText = `Save ${Math.round((1 - product.price / product.oldPrice) * 100)}%`; sbEl.style.display = 'inline-block'; }
        }

        // Gallery
        const mainImg = document.getElementById('product-main-image');
        const thumbsEl = document.getElementById('product-thumbnails');

        function loadGallery(images) {
            if (!images?.length) return;
            if (mainImg) mainImg.src = images[0];
            if (!thumbsEl) return;
            thumbsEl.innerHTML = images.map((src, i) =>
                `<img src="${src}" class="${i === 0 ? 'active' : ''}" alt="thumb ${i + 1}">`
            ).join('');
            thumbsEl.querySelectorAll('img').forEach(thumb => {
                thumb.addEventListener('click', function () {
                    thumbsEl.querySelectorAll('img').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    if (mainImg) mainImg.src = this.src;
                });
            });
        }

        const defaultImages = product.images?.length ? product.images : [product.image || ''];
        loadGallery(defaultImages);

        // Colors
        const colorContainer = document.getElementById('product-colors');
        const colorText = document.getElementById('selected-color-text');
        if (colorContainer && product.swatches?.length) {
            colorContainer.innerHTML = product.swatches.map((color, i) =>
                `<div class="color-circle ${i === 0 ? 'active' : ''}" style="background:${color};" data-color="${color}" title="${color}"></div>`
            ).join('');
            if (colorText) colorText.innerText = product.swatches[0];
            colorContainer.querySelectorAll('.color-circle').forEach(circle => {
                circle.addEventListener('click', function () {
                    colorContainer.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    if (colorText) colorText.innerText = this.dataset.color;
                    const colorImages = product.colorImages?.[this.dataset.color];
                    loadGallery(colorImages?.length ? colorImages : defaultImages);
                });
            });
        }

        // Sizes
        const sizeBtns = document.querySelectorAll('.size-btn');
        const sizeText = document.getElementById('selected-size-text');
        sizeBtns.forEach(btn => btn.addEventListener('click', function () {
            sizeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            if (sizeText) sizeText.innerText = this.innerText;
        }));

        // Quantity
        const qtyInput = document.getElementById('qty-value');
        document.getElementById('qty-minus')?.addEventListener('click', () => {
            if (parseInt(qtyInput.value) > 1) qtyInput.value = parseInt(qtyInput.value) - 1;
        });
        document.getElementById('qty-plus')?.addEventListener('click', () => {
            if (parseInt(qtyInput.value) < 99) qtyInput.value = parseInt(qtyInput.value) + 1;
        });

        // Wishlist
        const wishlistBtn = document.querySelector('.wishlist-btn');
        if (wishlistBtn) {
            wishlistBtn.dataset.wishlistId = product.id;
            WishlistDrawer.syncBtn(wishlistBtn, product.id);
            wishlistBtn.addEventListener('click', function () {
                Wishlist.toggle(product);
                WishlistDrawer.syncBtn(this, product.id);
            });
        }

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                this.classList.add('active');
                document.getElementById(`tab-${this.dataset.tab}`)?.classList.add('active');
            });
        });

        // Share
        const shareBtn = document.getElementById('shareBtn');
        const shareToast = document.getElementById('shareToast');
        if (shareBtn) {
            shareBtn.addEventListener('click', async e => {
                e.preventDefault();
                try { await navigator.clipboard.writeText(window.location.href); }
                catch { const el = document.createElement('textarea'); el.value = window.location.href; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); }
                if (shareToast) { shareToast.classList.add('visible'); setTimeout(() => shareToast.classList.remove('visible'), 2500); }
            });
        }

        // Ask a question
        const askBtn = document.getElementById('askQuestionBtn');
        const askModal = document.getElementById('askModal');
        if (askBtn && askModal) {
            const askClose = askModal.querySelector('.ask-close');
            const askForm = document.getElementById('askForm');
            const openAsk = () => { askModal.classList.add('open'); document.body.style.overflow = 'hidden'; };
            const closeAsk = () => { askModal.classList.remove('open'); askModal.classList.add('close'); setTimeout(() => askModal.classList.remove('close'), 400); document.body.style.overflow = ''; };
            askBtn.addEventListener('click', e => { e.preventDefault(); openAsk(); });
            if (askClose) askClose.addEventListener('click', closeAsk);
            window.addEventListener('click', e => { if (e.target === askModal) closeAsk(); });
            if (askForm) askForm.addEventListener('submit', e => { e.preventDefault(); closeAsk(); askForm.reset(); });
        }

        window._currentProduct = product;
        hideLoader();

    } catch (err) {
        console.error('Error loading product:', err);
        hideLoader();
    }

    // Timer
    let totalSeconds = 5 * 3600 + 59 * 60 + 47;
    const tH = document.getElementById('t-h');
    const tM = document.getElementById('t-m');
    const tS = document.getElementById('t-s');
    if (tH && tM && tS) {
        const tick = () => {
            if (totalSeconds <= 0) return; totalSeconds--;
            tH.innerText = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            tM.innerText = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            tS.innerText = String(totalSeconds % 60).padStart(2, '0');
        };
        setInterval(tick, 1000); tick();
    }
});


/* ============================================================
   8. CART PAGE — render items from localStorage
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const cartPageEmpty = document.getElementById('cartPageEmpty');
    const cartPageContent = document.getElementById('cartPageContent');
    const cartTableBody = document.getElementById('cartTableBody');
    const cartPageSubtotal = document.getElementById('cartPageSubtotal');
    const giftWrapCheck = document.getElementById('giftWrapCheck');

    if (!cartPageEmpty || !cartPageContent || !cartTableBody) return;

    function renderCartPage() {
        const items = Cart.getItems();
        const isEmpty = items.length === 0;
        cartPageEmpty.style.display = isEmpty ? 'flex' : 'none';
        cartPageContent.style.display = isEmpty ? 'none' : 'block';
        if (isEmpty) return;

        cartTableBody.innerHTML = '';
        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'cart-page-item';

            const colorDot = item.color && item.color.startsWith('#')
                ? `<span class="cart-color-dot" style="background:${item.color};border:1px solid rgba(0,0,0,.15);display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:middle;"></span>`
                : '';
            const colorText = item.color && item.color.startsWith('#') ? '' : (item.color || '—');

            row.innerHTML = `
            <img class="cart-page-item-img" src="${item.image}" alt="${item.name}" onerror="this.style.background='#f5f5f5'">
            <div class="cart-page-item-details">
                <div class="cart-page-item-name-row">
                    <p class="cart-page-item-name">${item.name}</p>
                    <button class="cart-page-item-remove mobile-remove" data-idx="${index}" aria-label="Видалити">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <p class="cart-page-attr">Розмір: <strong>${item.size || '—'}</strong></p>
                <p class="cart-page-attr">Колір: ${colorDot} ${colorText}</p>
                <div class="cart-page-mobile-price-row">
                    <span class="cart-page-item-price">$${item.price.toFixed(2)}</span>
                    <div class="cart-page-qty">
                        <button class="cp-minus" data-idx="${index}">−</button>
                        <span class="cart-page-qty-num">${item.qty}</span>
                        <button class="cp-plus" data-idx="${index}">+</button>
                    </div>
                    <span class="cart-page-item-total">$${(item.price * item.qty).toFixed(2)}</span>
                </div>
                <button class="cart-page-item-remove desktop-remove" data-idx="${index}">Прибрати</button>
            </div>
            <span class="cart-desktop-price">$${item.price.toFixed(2)}</span>
            <div class="cart-desktop-qty">
                <div class="cart-page-qty">
                    <button class="cp-minus" data-idx="${index}">−</button>
                    <span class="cart-page-qty-num">${item.qty}</span>
                    <button class="cp-plus" data-idx="${index}">+</button>
                </div>
            </div>
            <span class="cart-desktop-total">$${(item.price * item.qty).toFixed(2)}</span>`;

            cartTableBody.appendChild(row);
        });

        updateSubtotal();

        cartTableBody.querySelectorAll('.cp-minus').forEach(btn => {
            btn.addEventListener('click', () => { Cart.updateQty(+btn.dataset.idx, -1); renderCartPage(); });
        });
        cartTableBody.querySelectorAll('.cp-plus').forEach(btn => {
            btn.addEventListener('click', () => { Cart.updateQty(+btn.dataset.idx, 1); renderCartPage(); });
        });
        cartTableBody.querySelectorAll('.cart-page-item-remove').forEach(btn => {
            btn.addEventListener('click', () => { Cart.remove(+btn.dataset.idx); renderCartPage(); });
        });
    }

    function updateSubtotal() {
        let total = Cart.getTotalPrice();
        if (giftWrapCheck && giftWrapCheck.checked) total += 10;
        if (cartPageSubtotal) cartPageSubtotal.innerText = `$${total.toFixed(2)}`;
    }

    if (giftWrapCheck) giftWrapCheck.addEventListener('change', updateSubtotal);

    const checkoutBtn = document.getElementById('cartCheckoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            alert('Оформлення замовлення вже скоро!');
        });
    }

    renderCartPage();
});

/* ============================================================
   9. DEAL GALLERY SWIPER (desktop)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('dealGallery');
    const track = document.getElementById('dealTrack');
    const prevBtn = document.getElementById('dealPrev');
    const nextBtn = document.getElementById('dealNext');

    if (!gallery || !track || !prevBtn || !nextBtn) return;

    const dots = document.getElementById('dealDots');
    const dotEls = dots ? [...dots.querySelectorAll('div')] : [];
    const slideNum = document.getElementById('dealSlideNum');
    const saleName = document.getElementById('dealSaleName');
    const discount = document.getElementById('dealDiscount');
    const saleBox = gallery.querySelector('.sale-box');
    const total = track.querySelectorAll('.deal-slide').length;
    let currentIndex = 0;
    let isSliding = false;

    /* Розраховує крок зсуву = ширина слайду + gap треку */
    function getStep() {
        const first = track.firstElementChild;
        if (!first) return 0;
        const w = first.getBoundingClientRect().width;
        const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || 0) || 0;
        return w + gap;
    }

    /* Оновлює плашку з даними з активного (першого) слайду */
    function syncSaleBox() {
        const first = track.firstElementChild;
        if (!first) return;
        if (slideNum) slideNum.textContent = (currentIndex % total) + 1;
        if (saleName && first.dataset.name) saleName.textContent = first.dataset.name;
        if (discount && first.dataset.discount)
            discount.textContent = `ЗНИЖКА ${first.dataset.discount}%`;
    }

    function syncDots() {
        const idx = ((currentIndex % total) + total) % total;
        dotEls.forEach((d, i) => d.classList.toggle('progress-highlight', i === idx));
    }

    const ANIM_MS = 550;

    /* NEXT: 1-й слайд переноситься в кінець (нескінченна карусель).
       2-й під час слайду виростає до 100%, 1-й залишається 100% поки не зникне за межами */
    function next() {
        if (isSliding) return;
        isSliding = true;
        const step = getStep();
        const slides = track.children;
        const newActive = slides[1];
        if (newActive) newActive.classList.add('is-active');

        if (saleBox) saleBox.classList.add('is-fading');

        track.style.transition = `transform ${ANIM_MS}ms cubic-bezier(.4, 0, .2, 1)`;
        track.style.transform = `translateX(-${step}px)`;

        setTimeout(() => {
            const oldFirst = track.firstElementChild;
            if (oldFirst) {
                oldFirst.classList.remove('is-active');
                track.appendChild(oldFirst);
            }
            track.style.transition = 'none';
            track.style.transform = 'translateX(0)';
            void track.offsetHeight;
            currentIndex = (currentIndex + 1) % total;
            syncSaleBox();
            syncDots();
            if (saleBox) saleBox.classList.remove('is-fading');
            isSliding = false;
        }, ANIM_MS + 20);
    }

    /* PREV: останній слайд переноситься на початок, потім трек повертається до 0 */
    function prev() {
        if (isSliding) return;
        isSliding = true;
        const step = getStep();
        const last = track.lastElementChild;
        if (!last) { isSliding = false; return; }

        /* 1. Без анімації: переносимо last → first, висоту виставляємо в 100% і трек у -step. */
        track.style.transition = 'none';
        last.style.transition = 'none';
        track.insertBefore(last, track.firstElementChild);
        last.classList.add('is-active');
        track.style.transform = `translateX(-${step}px)`;
        void track.offsetHeight; /* reflow */
        last.style.transition = '';

        if (saleBox) saleBox.classList.add('is-fading');

        /* 2. Подвійний rAF гарантує, що браузер «зафіксує» стан -step як стартовий, а вже потім
              у наступному кадрі ми вмикаємо транзицію і змінюємо transform → 0 — лише так
              анімація гарантовано програється. */
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                track.style.transition = `transform ${ANIM_MS}ms cubic-bezier(.4, 0, .2, 1)`;
                track.style.transform = 'translateX(0)';
            });
        });

        setTimeout(() => {
            const second = track.children[1];
            if (second) second.classList.remove('is-active');
            track.style.transition = 'none';
            currentIndex = ((currentIndex - 1) % total + total) % total;
            syncSaleBox();
            syncDots();
            if (saleBox) saleBox.classList.remove('is-fading');
            isSliding = false;
        }, ANIM_MS + 60);
    }

    nextBtn.addEventListener('click', next);
    prevBtn.addEventListener('click', prev);

    /* Клік по крапках — рухаємось вперед стільки разів, скільки потрібно */
    dotEls.forEach((dot, i) => dot.addEventListener('click', () => {
        if (isSliding) return;
        const cur = ((currentIndex % total) + total) % total;
        let diff = (i - cur + total) % total;
        if (diff === 0) return;
        /* Послідовно йдемо вперед, чекаючи завершення кожного слайдінгу */
        const stepFwd = () => {
            if (diff <= 0) return;
            diff--;
            next();
            if (diff > 0) setTimeout(stepFwd, 600);
        };
        stepFwd();
    }));

    /* Авто-програвання кожні 5с (пауза при наведенні) */
    let autoPlay = setInterval(next, 5000);
    gallery.addEventListener('mouseenter', () => clearInterval(autoPlay));
    gallery.addEventListener('mouseleave', () => {
        clearInterval(autoPlay);
        autoPlay = setInterval(next, 5000);
    });

    /* Свайп на тач-пристроях */
    let touchStartX = 0;
    gallery.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    gallery.addEventListener('touchend', e => {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) (diff > 0 ? next : prev)();
    });
});


/* ============================================================
   10. SEASON DEAL COUNTDOWN TIMER
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const dEl = document.getElementById('timerDays');
    const hEl = document.getElementById('timerHours');
    const mEl = document.getElementById('timerMinutes');
    const sEl = document.getElementById('timerSeconds');

    if (!dEl || !hEl || !mEl || !sEl) return;

    // Зберігаємо кінцевий час у localStorage, щоб таймер не скидався при перезавантаженні
    const KEY = 'fasco_deal_end';
    let endTime = parseInt(localStorage.getItem(KEY) || '0');
    const TWO_DAYS_MS = (2 * 86400 + 6 * 3600 + 5 * 60 + 30) * 1000;

    if (!endTime || endTime < Date.now()) {
        endTime = Date.now() + TWO_DAYS_MS;
        localStorage.setItem(KEY, endTime);
    }

    const pad = n => String(n).padStart(2, '0');

    function tick() {
        const diff = Math.max(0, endTime - Date.now());
        const totalSec = Math.floor(diff / 1000);

        dEl.textContent = pad(Math.floor(totalSec / 86400));
        hEl.textContent = pad(Math.floor((totalSec % 86400) / 3600));
        mEl.textContent = pad(Math.floor((totalSec % 3600) / 60));
        sEl.textContent = pad(totalSec % 60);

        if (diff > 0) setTimeout(tick, 1000);
    }

    tick();
});


/* ============================================================
   11. INSTAGRAM SCROLL GALLERY
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('instaGallery');
    if (!gallery) return;

    const origImgs = [...gallery.querySelectorAll('img')];
    const total = origImgs.length; // 7

    // Дублюємо фото для безшовного циклу
    origImgs.forEach(img => gallery.appendChild(img.cloneNode(true)));

    let offset = 0;   // поточний зсув у кількості фото
    let isAnimating = false;

    function getStep() {
        // Скільки % займає одне фото
        return window.innerWidth >= 1024 ? 100 / 7 : 100 / 3;
    }

    function shift(dir) {
        if (isAnimating) return;
        isAnimating = true;

        offset = (offset + dir + total * 100) % total;

        // Увімкнути transition перед зсувом
        gallery.classList.add('is-animating');
        gallery.style.transform = `translateX(-${offset * getStep()}%)`;

        setTimeout(() => {
            gallery.classList.remove('is-animating');
            isAnimating = false;
        }, 730);
    }

    // Слухаємо scroll тільки коли секція у viewport
    const section = gallery.closest('.instagram');
    if (!section) return;

    let lastY = window.scrollY;
    let accumY = 0;
    const THRESH = 110; // px прокрутки → 1 фото

    window.addEventListener('scroll', () => {
        const rect = section.getBoundingClientRect();
        // Якщо секція не у viewport — скидаємо накопичене
        if (rect.top > window.innerHeight || rect.bottom < 0) {
            lastY = window.scrollY;
            accumY = 0;
            return;
        }

        const dy = window.scrollY - lastY;
        lastY = window.scrollY;
        accumY += dy;

        if (accumY >= THRESH) {
            shift(1);
            accumY = 0;
        } else if (accumY <= -THRESH) {
            shift(-1);
            accumY = 0;
        }
    }, { passive: true });
});

/* ============================================================
   CHECKOUT PAGE — order summary + form helpers
   Reads cart from localStorage (key: fasco_cart). Falls back to
   demo items so the page is presentable even on an empty cart.
   ============================================================ */
(function () {
    const STORAGE_KEY = 'fasco_cart';
    const SHIPPING_THRESHOLD = 75;
    const SHIPPING_FEE = 9.99;

    const DEMO_ITEMS = [
        {
            id: 'demo-1',
            name: 'Сукня міні з рюшами на бретелях',
            price: 108,
            qty: 1,
            size: 'M',
            color: 'Червоний',
            image: './assets/images/new-1.webp'
        },
        {
            id: 'demo-2',
            name: 'Льняна сорочка з довгим рукавом',
            price: 32,
            qty: 1,
            size: 'L',
            color: 'Бежевий',
            image: './assets/images/new-2.webp'
        }
    ];

    const $ = (id) => document.getElementById(id);

    function loadItems() {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (Array.isArray(raw) && raw.length) return raw;
        } catch (e) { /* ignore */ }
        return DEMO_ITEMS;
    }

    function fmt(n) {
        return '$' + (Math.round(n * 100) / 100).toFixed(2);
    }

    let items = loadItems();
    let promoPercent = 0;

    function renderItems() {
        const wrap = $('checkoutSummaryItems');
        if (!wrap) return;
        wrap.innerHTML = items.map(it => {
            const meta = [it.size && `Розмір: ${it.size}`, it.color && `Колір: ${it.color}`]
                .filter(Boolean).join(' • ');
            const total = (it.price * it.qty);
            return `
                <div class="checkout-summary-item">
                    <div class="cs-img">
                        <img src="${it.image || './assets/images/shop_icon.webp'}" alt="${it.name}">
                        <span class="cs-qty">${it.qty}</span>
                    </div>
                    <div class="cs-info">
                        <p class="cs-title">${it.name}</p>
                        ${meta ? `<p class="cs-meta">${meta}</p>` : ''}
                    </div>
                    <div class="cs-price">${fmt(total)}</div>
                </div>`;
        }).join('');
    }

    function renderTotals() {
        const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
        const discount = subtotal * (promoPercent / 100);
        const subAfterDiscount = subtotal - discount;
        const shipping = subAfterDiscount >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
        const total = subAfterDiscount + shipping;

        if ($('ckSubtotal')) $('ckSubtotal').textContent = fmt(subtotal);

        const discountRow = $('ckDiscountRow');
        if (discountRow) {
            if (promoPercent > 0) {
                discountRow.style.display = '';
                $('ckDiscount').textContent = '-' + fmt(discount);
            } else {
                discountRow.style.display = 'none';
            }
        }

        if ($('ckShipping')) {
            $('ckShipping').textContent = shipping === 0 ? 'Безкоштовно' : fmt(shipping);
        }
        if ($('ckTotal')) $('ckTotal').textContent = fmt(total);
    }

    function applyPromo() {
        const input = $('ck-promo');
        const msg = $('ckPromoMsg');
        if (!input || !msg) return;
        const code = input.value.trim().toLowerCase();

        const codes = {
            'fasco10': 10,
            'fasco20': 20,
            'first5': 5
        };

        if (!code) {
            promoPercent = 0;
            msg.textContent = '';
            msg.className = 'checkout-promo-msg';
        } else if (codes[code]) {
            promoPercent = codes[code];
            msg.textContent = `Промокод застосовано: -${promoPercent}%`;
            msg.className = 'checkout-promo-msg is-ok';
        } else {
            promoPercent = 0;
            msg.textContent = 'Невірний промокод';
            msg.className = 'checkout-promo-msg is-err';
        }
        renderTotals();
    }

    /* PAYMENT METHOD: toggle card fields visibility ------------ */
    function bindPaymentMethods() {
        const radios = document.querySelectorAll('input[name="payment-method"]');
        const cardFields = $('paymentCardFields');
        if (!cardFields || !radios.length) return;

        const update = () => {
            const checked = document.querySelector('input[name="payment-method"]:checked');
            const isCard = checked && checked.value === 'card';
            cardFields.hidden = !isCard;
            document.querySelectorAll('.payment-method').forEach(el => {
                el.classList.toggle('is-active', el.contains(checked));
            });
        };
        radios.forEach(r => r.addEventListener('change', update));
        update();
    }

    /* INPUT MASKS ---------------------------------------------- */
    function bindMasks() {
        const num = $('ck-cardnum');
        if (num) {
            num.addEventListener('input', () => {
                let v = num.value.replace(/\D/g, '').slice(0, 19);
                num.value = v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
            });
        }
        const exp = $('ck-exp');
        if (exp) {
            exp.addEventListener('input', () => {
                let v = exp.value.replace(/\D/g, '').slice(0, 4);
                if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
                exp.value = v;
            });
        }
        const cvc = $('ck-cvc');
        if (cvc) {
            cvc.addEventListener('input', () => {
                cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4);
            });
        }
        const postal = $('ck-postal');
        if (postal) {
            postal.addEventListener('input', () => {
                postal.value = postal.value.replace(/[^\dA-Za-z\s-]/g, '').slice(0, 10);
            });
        }
    }

    /* SUBMIT --------------------------------------------------- */
    function bindSubmit() {
        const form = $('checkoutForm');
        if (!form) return;
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const required = ['ck-email', 'ck-country', 'ck-firstname', 'ck-lastname',
                'ck-address', 'ck-city', 'ck-postal'];
            let firstInvalid = null;
            for (const id of required) {
                const el = $(id);
                if (!el) continue;
                if (!el.value || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value))) {
                    el.classList.add('is-invalid');
                    if (!firstInvalid) firstInvalid = el;
                } else {
                    el.classList.remove('is-invalid');
                }
            }
            if (firstInvalid) {
                firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstInvalid.focus({ preventScroll: true });
                return;
            }

            const btn = form.querySelector('.checkout-pay-btn');
            if (btn) {
                const original = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>Замовлення оформлено</span>';
                btn.style.background = '#2e8b57';
                setTimeout(() => {
                    alert('Дякуємо! Це демо-сторінка. У реальному магазині ви були б перенаправлені на оплату.');
                    btn.disabled = false;
                    btn.innerHTML = original;
                    btn.style.background = '';
                }, 900);
            }
        });
    }

    function init() {
        renderItems();
        renderTotals();
        bindPaymentMethods();
        bindMasks();
        bindSubmit();
        const applyBtn = $('ck-promo-apply');
        if (applyBtn) applyBtn.addEventListener('click', applyPromo);
        const promo = $('ck-promo');
        if (promo) promo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); applyPromo(); }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
