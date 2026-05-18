const $ = (id) => document.getElementById(id);

// === CART ===

const Cart = (() => {
    const STORAGE_KEY = 'fasco_cart';
    const FREE_SHIPPING = 75;
    let items = [];

    const load = () => {
        try { items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
        catch { items = []; }
    };
    const save = () => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* quota */ }
        try { window.FascoApp?.notifyCartChanged?.(); } catch { /* ignore */ }
    };
    const reload = () => {
        load();
        CartDrawer?.render?.();
        CartDrawer?.updateBadges?.();
    };
    const getItems = () => items;
    const getTotalQty = () => items.reduce((s, i) => s + i.qty, 0);
    const getTotalPrice = () => items.reduce((s, i) => s + i.price * i.qty, 0);

    function add(product, qty, size, color) {
        const ex = items.find(i => i.id === product.id && i.size === size && i.color === color);
        if (ex) ex.qty = Math.min(ex.qty + qty, 99);
        else items.push({
            id: product.id, name: product.name, price: product.price,
            image: product.images?.[0] || product.image || '',
            size, color, qty: Math.min(qty, 99),
        });
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
    const getFreeShippingRemaining = () => Math.max(0, FREE_SHIPPING - getTotalPrice());
    const getFreeShippingProgress = () => Math.min(100, (getTotalPrice() / FREE_SHIPPING) * 100);

    load();
    return { getItems, getTotalQty, getTotalPrice, add, updateQty, remove, reload, getFreeShippingRemaining, getFreeShippingProgress };
})();

// === WISHLIST ===

const Wishlist = (() => {
    const STORAGE_KEY = 'fasco_wishlist';
    let items = [];

    const load = () => {
        try { items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
        catch { items = []; }
    };
    const save = () => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* quota */ }
        try { window.FascoApp?.notifyWishlistChanged?.(); } catch { /* ignore */ }
    };
    const reload = () => {
        load();
        WishlistDrawer?.render?.();
        WishlistDrawer?.updateBadges?.();
    };
    const getItems = () => items;
    const getCount = () => items.length;
    const has = (id) => items.some(i => i.id === id);

    function toggle(product) {
        const idx = items.findIndex(i => i.id === product.id);
        if (idx >= 0) items.splice(idx, 1);
        else items.push({
            id: product.id, name: product.name, price: product.price,
            image: product.images?.[0] || product.image || '',
            oldPrice: product.oldPrice || null,
        });
        save(); WishlistDrawer.render(); WishlistDrawer.updateBadges();
        return has(product.id);
    }

    load();
    return { getItems, getCount, has, toggle, reload };
})();

// При зміні стану кошика/вішліста через Firebase оновлюємо UI та сердечка.
function refreshWishlistButtons() {
    document.querySelectorAll('[data-wishlist-id]').forEach(btn => {
        const id = parseInt(btn.dataset.wishlistId);
        const isWish = Wishlist.has(id);
        btn.classList.toggle('active', isWish);
        const icon = btn.querySelector('i');
        if (icon) icon.className = (isWish ? 'fa-solid' : 'fa-regular') + ' fa-heart';
    });
}

window.addEventListener('fasco:remote-sync', () => {
    try {
        Cart.reload?.();
        Wishlist.reload?.();
        refreshWishlistButtons();
    } catch (e) { console.warn('[Fasco] remote-sync error', e); }
});

// === CART DRAWER ===

const CartDrawer = (() => {
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
        for (const elId of ['cartBadge', 'stickyCartCount']) {
            const el = $(elId);
            if (el) { el.innerText = str; el.style.display = qty === 0 ? 'none' : 'flex'; }
        }
        const count = $('cartItemsCount');
        if (count) count.innerText = qty;
    }

    function updateShippingBar() {
        const remaining = Cart.getFreeShippingRemaining();
        const fill = $('shippingProgressFill');
        if (fill) fill.style.width = Cart.getFreeShippingProgress() + '%';
        const text = $('cartShippingText');
        if (text) {
            text.innerHTML = remaining <= 0
                ? '<strong>🎉 Безкоштовна доставка розблокована!</strong>'
                : `Додайте ще <strong>$${remaining.toFixed(2)}</strong> для <strong>безкоштовної доставки!</strong>`;
        }
        const costEl = $('cartShippingCost');
        if (costEl) {
            costEl.innerHTML = remaining <= 0 ? '<strong>$0.00</strong>' : 'Розраховується при оформленні';
            costEl.closest('.cart-total-row')?.classList.toggle('cart-total-row--muted', remaining > 0);
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
            const colorSwatch = item.color?.startsWith('#')
                ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${item.color};border:1px solid #ddd;vertical-align:middle;"></span>` : '';
            const div = document.createElement('div');
            div.className = 'cart-item';
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
            $('cartDrawerOverlay')?.addEventListener('click', close);
            $('cartDrawerClose')?.addEventListener('click', close);
            $('continueShoppingBtn')?.addEventListener('click', close);
            $('stickyCartLink')?.addEventListener('click', e => { e.preventDefault(); open(); });
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && $('cartDrawer')?.classList.contains('open')) close();
            });
            render();
            updateBadges();

            const addBtn = $('addToCartBtn');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    const product = window._currentProduct;
                    if (!product) return;
                    const qty = parseInt($('qty-value')?.value || 1);
                    const sizeEl = $('selected-size-text');
                    const size = sizeEl?.dataset?.size?.trim() || sizeEl?.innerText?.trim() || 'M';
                    const rawColor = $('selected-color-text')?.innerText?.trim() || '';
                    const color = rawColor === '—' ? '' : rawColor;
                    const orig = addBtn.innerHTML;
                    addBtn.classList.add('added');
                    addBtn.innerHTML = '<i class="fa-solid fa-check"></i> Додано!';
                    setTimeout(() => { addBtn.classList.remove('added'); addBtn.innerHTML = orig; }, 1500);
                    Cart.add(product, qty, size, color);
                    open();
                });
            }
        });
    }

    return { init, open, close, render, updateBadges };
})();
CartDrawer.init();

// === WISHLIST DRAWER ===

const WishlistDrawer = (() => {
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
            const oldPriceHTML = item.oldPrice ? `<span class="wishlist-item-old-price">$${item.oldPrice.toFixed(2)}</span>` : '';
            const div = document.createElement('div');
            div.className = 'wishlist-item';
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
                if (!product) return;
                Wishlist.toggle(product);
                document.querySelectorAll(`[data-wishlist-id="${id}"]`).forEach(heartBtn => {
                    heartBtn.classList.remove('active');
                    const icon = heartBtn.querySelector('i');
                    if (icon) icon.className = 'fa-regular fa-heart';
                });
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
            $('wishlistToggleBtn')?.addEventListener('click', e => { e.preventDefault(); open(); });
            $('mobileWishlistBtn')?.addEventListener('click', e => { e.preventDefault(); open(); });
            $('wishlistDrawerOverlay')?.addEventListener('click', close);
            $('wishlistDrawerClose')?.addEventListener('click', close);
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

// === SEARCH OVERLAY ===

const SearchOverlay = (() => {
    let allProducts = [];
    let isLoaded = false;

    async function loadProducts() {
        if (isLoaded) return;
        try {
            allProducts = await (await fetch('./assets/data/products.json')).json();
            isLoaded = true;
        } catch { console.warn('Search: could not load products'); }
    }

    function highlight(text, q) {
        if (!q) return text;
        return text.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
    }

    function renderResults(query) {
        const grid = $('searchResultsGrid');
        const hint = $('searchHint');
        if (!grid) return;
        if (!query) { grid.innerHTML = ''; if (hint) hint.style.display = 'block'; return; }
        if (hint) hint.style.display = 'none';
        const matches = allProducts.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
        if (!matches.length) {
            grid.innerHTML = `<p class="search-no-results">Нічого не знайдено за запитом "<strong>${query}</strong>"</p>`;
            return;
        }
        const ending = matches.length === 1 ? '' : matches.length < 5 ? 'и' : 'ів';
        grid.innerHTML = '';
        const countEl = document.createElement('p');
        countEl.className = 'search-results-count';
        countEl.innerText = `Знайдено: ${matches.length} товар${ending}`;
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
        window._shopFilterBySearch?.(query);
    }

    function open() {
        const overlay = $('searchOverlay');
        if (!overlay) return;
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        loadProducts();
        setTimeout(() => $('searchInput')?.focus(), 100);
    }
    function close() {
        const overlay = $('searchOverlay');
        if (!overlay) return;
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        const input = $('searchInput'); if (input) input.value = '';
        const grid = $('searchResultsGrid'); if (grid) grid.innerHTML = '';
        const hint = $('searchHint'); if (hint) hint.style.display = 'block';
    }

    function init() {
        document.addEventListener('DOMContentLoaded', () => {
            $('searchToggleBtn')?.addEventListener('click', e => { e.preventDefault(); open(); });
            $('mobileSearchBtn')?.addEventListener('click', e => { e.preventDefault(); open(); });
            $('searchClose')?.addEventListener('click', close);
            const overlay = $('searchOverlay');
            overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });
            const input = $('searchInput');
            if (input) {
                let timer;
                input.addEventListener('input', () => {
                    clearTimeout(timer);
                    timer = setTimeout(() => renderResults(input.value.trim()), 180);
                });
            }
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && overlay?.classList.contains('open')) close();
            });
        });
    }
    return { init, open, close };
})();
SearchOverlay.init();

// === PAGE LOADER ===

document.addEventListener('DOMContentLoaded', () => {
    const loader = $('pageLoader');
    if (!loader) return;
    const hide = () => loader.classList.add('hidden');
    if (document.readyState === 'complete') hide();
    else { window.addEventListener('load', hide); setTimeout(hide, 1200); }
});

// === MOBILE MENU ===

document.addEventListener('DOMContentLoaded', () => {
    const burgerBtn = $('burgerMenu');
    const openIcon = $('openIcon');
    const closeIcon = $('closeIcon');
    const panel = $('mobileMenuPanel');
    const overlay = $('mobileMenuOverlay');
    const closeBtn = $('mobileMenuClose');
    if (!burgerBtn || !panel) return;

    const openMenu = () => {
        panel.classList.add('open');
        overlay?.classList.add('visible');
        document.body.style.overflow = 'hidden';
        openIcon?.classList.add('d-none');
        closeIcon?.classList.remove('d-none');
    };
    const closeMenu = () => {
        panel.classList.remove('open');
        overlay?.classList.remove('visible');
        document.body.style.overflow = '';
        openIcon?.classList.remove('d-none');
        closeIcon?.classList.add('d-none');
    };

    burgerBtn.addEventListener('click', () => panel.classList.contains('open') ? closeMenu() : openMenu());
    closeBtn?.addEventListener('click', closeMenu);
    overlay?.addEventListener('click', closeMenu);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && panel.classList.contains('open')) closeMenu();
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024 && panel.classList.contains('open')) closeMenu();
    });
});

// === SCROLL TO TOP ===

document.addEventListener('DOMContentLoaded', () => {
    $('scrollToTop')?.addEventListener('click', e => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

// === INFO MODALS (Support / Payment / Contacts / Careers / Blog / FAQ) ===

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
            </div>`,
    };

    if (document.querySelector('.footer-nav')) {
        Object.entries(MODALS).forEach(([id, html]) => {
            if ($(id)) return;
            const el = document.createElement('div');
            el.id = id;
            el.className = 'modal-overlay';
            el.innerHTML = html;
            document.body.appendChild(el);
        });
    }

    const closeModal = (modal) => {
        modal.classList.remove('open'); modal.classList.add('close');
        setTimeout(() => modal.classList.remove('close'), 400);
        document.body.style.overflow = '';
    };
    const openModal = (modal) => {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    document.addEventListener('click', e => {
        const trigger = e.target.closest('[data-modal-target]');
        if (trigger) {
            e.preventDefault();
            const modal = $(trigger.dataset.modalTarget);
            if (modal) openModal(modal);
            return;
        }
        if (e.target.closest('#supportBtn')) {
            e.preventDefault();
            const modal = $('myModal'); if (modal) openModal(modal);
            return;
        }
        if (e.target.classList.contains('close-modal')) {
            const m = e.target.closest('.modal-overlay');
            if (m) closeModal(m);
            return;
        }
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

// === REVIEWS CAROUSEL ===

document.addEventListener('DOMContentLoaded', () => {
    const carousel = document.querySelector('.reviews-wrapper .carousel');
    if (!carousel) return;
    const cards = document.querySelectorAll('.review-card');
    const prevBtn = document.querySelector('.reviews .nav-btn.prev');
    const nextBtn = document.querySelector('.reviews .nav-btn.next');
    if (!cards.length || !prevBtn || !nextBtn) return;

    let idx = 1;
    const total = cards.length;
    const update = () => {
        cards.forEach((c, i) => {
            c.classList.remove('active', 'prev', 'next');
            c.style.display = 'flex';
            const pos = (i - idx + total) % total;
            if (pos === 0) c.classList.add('active');
            else if (pos === 1) c.classList.add('next');
            else if (pos === total - 1) c.classList.add('prev');
            else c.style.display = 'none';
        });
    };
    nextBtn.addEventListener('click', () => { idx = (idx + 1) % total; update(); });
    prevBtn.addEventListener('click', () => { idx = (idx - 1 + total) % total; update(); });
    update();
});

// === SHOP PAGE — products + filters + wishlist on cards ===

document.addEventListener('DOMContentLoaded', () => {
    const productGrid = $('product-grid');
    const sortSelect = $('sort');
    const paginationContainer = $('pagination-container');
    const viewOptions = document.querySelector('.view-options');
    if (!productGrid || !sortSelect || !paginationContainer || !viewOptions) return;

    let allProducts = [];
    let stockMap = {};
    let currentPage = 1;
    let itemsPerPage = 9;
    let currentLayout = 'grid-3';
    let activeFilters = { sizes: [], colors: [], priceMin: null, priceMax: null, collection: 'all' };
    let searchQuery = '';

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
        accessories: 'Аксесуари',
    };

    window._shopFilterBySearch = q => { searchQuery = q.toLowerCase(); currentPage = 1; renderPage(); };

    async function loadProducts() {
        try {
            const [productsRes, stocks] = await Promise.all([
                fetch('./assets/data/products.json'),
                window.FascoApp?.getAllStock?.().catch(() => ({})) ?? Promise.resolve({}),
            ]);
            if (!productsRes.ok) throw new Error('products');
            allProducts = await productsRes.json();
            stockMap = stocks || {};
            renderPage();
        } catch {
            productGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px;color:#aaa;">Помилка завантаження.</p>';
        }
    }

    // Розмір вважається доступним, якщо у всіх кольорах, де він є, qty > 0.
    function availableSizesOf(p) {
        const stock = stockMap[String(p.id)] || {};
        const colors = Object.values(stock);
        if (!colors.length) return new Set();
        const allSizes = new Set();
        colors.forEach(byColor => Object.keys(byColor || {}).forEach(s => allSizes.add(s)));
        const set = new Set();
        allSizes.forEach(size => {
            const relevant = colors.filter(byColor => size in (byColor || {}));
            if (relevant.length && relevant.every(byColor => Number(byColor[size]) > 0)) set.add(size);
        });
        return set;
    }

    function applyFilters(products) {
        return products.filter(p => {
            if (activeFilters.collection !== 'all' && !(p.collections || []).includes(activeFilters.collection)) return false;
            if (activeFilters.priceMin !== null && p.price < activeFilters.priceMin) return false;
            if (activeFilters.priceMax !== null && p.price > activeFilters.priceMax) return false;
            if (activeFilters.colors.length) {
                const ok = activeFilters.colors.some(c => (p.swatches || []).some(s => s.toLowerCase() === c.toLowerCase()));
                if (!ok) return false;
            }
            if (activeFilters.sizes.length) {
                const avail = availableSizesOf(p);
                if (!activeFilters.sizes.some(s => avail.has(s))) return false;
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
            const swatchesHTML = (product.swatches || []).map(c => `<span class="swatch" style="background:${c};" title="${c}"></span>`).join('');
            const oldPriceHTML = product.oldPrice ? `<span class="old-price">$${product.oldPrice.toFixed(2)}</span>` : '';
            const saleBadge = product.oldPrice ? `<span class="sale-badge-small">Sale</span>` : '';
            const defaultImg = product.images?.[0] || product.image || '';
            // Hover-фото: беремо 4-те (альтернативний ракурс), інакше 2-ге, інакше дефолтне.
            const hoverImg = product.images?.[3] || product.images?.[1] || defaultImg;
            const isWishlisted = Wishlist.has(product.id);

            const card = document.createElement('div');
            card.className = 'product-card';
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

        const goTo = (page) => {
            currentPage = page;
            renderPage();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        const addLink = (label, page) => {
            const a = document.createElement('a');
            a.innerText = label;
            a.dataset.page = page;
            a.addEventListener('click', e => { e.preventDefault(); goTo(page); });
            return a;
        };

        if (currentPage > 1) paginationContainer.appendChild(addLink('«', currentPage - 1));

        const pages = [];
        if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
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
                const s = document.createElement('span'); s.innerText = '...';
                paginationContainer.appendChild(s);
            } else {
                const a = addLink(page, page);
                if (page === currentPage) a.classList.add('active');
                paginationContainer.appendChild(a);
            }
        });

        if (currentPage < totalPages) paginationContainer.appendChild(addLink('»', currentPage + 1));
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

    document.querySelectorAll('#collectionList a[data-collection]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const col = link.dataset.collection;
            activeFilters.collection = col;
            document.querySelectorAll('#collectionList a').forEach(a => a.classList.remove('active-collection'));
            link.classList.add('active-collection');
            const url = new URL(location.href);
            if (col === 'all') url.searchParams.delete('collection');
            else url.searchParams.set('collection', col);
            history.replaceState(null, '', url);
            currentPage = 1; renderPage();
        });
    });

    function makeTag(html, onClick) {
        const t = document.createElement('span');
        t.className = 'active-filter-tag';
        t.innerHTML = html;
        t.addEventListener('click', onClick);
        return t;
    }

    function renderActiveFilterTags() {
        let bar = $('activeFiltersBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'activeFiltersBar';
            bar.className = 'active-filters-bar';
            productGrid.before(bar);
        }
        bar.innerHTML = '';
        if (!activeFilters.colors.length && !activeFilters.sizes.length && activeFilters.priceMin === null && !searchQuery && activeFilters.collection === 'all') return;

        if (activeFilters.collection !== 'all') {
            bar.appendChild(makeTag(
                `${collectionLabels[activeFilters.collection] || activeFilters.collection} <i class="fa-solid fa-xmark"></i>`,
                () => {
                    activeFilters.collection = 'all';
                    document.querySelectorAll('#collectionList a').forEach(a => a.classList.remove('active-collection'));
                    document.querySelector('#collectionList a[data-collection="all"]')?.classList.add('active-collection');
                    const url = new URL(location.href); url.searchParams.delete('collection'); history.replaceState(null, '', url);
                    currentPage = 1; renderPage();
                },
            ));
        }
        if (activeFilters.priceMin !== null) {
            bar.appendChild(makeTag(
                `$${activeFilters.priceMin}–$${activeFilters.priceMax} <i class="fa-solid fa-xmark"></i>`,
                () => {
                    activeFilters.priceMin = null; activeFilters.priceMax = null;
                    document.querySelectorAll('.filter-group li.active-price').forEach(li => li.classList.remove('active-price'));
                    currentPage = 1; renderPage();
                },
            ));
        }
        activeFilters.sizes.forEach(size => {
            bar.appendChild(makeTag(
                `${size} <i class="fa-solid fa-xmark"></i>`,
                () => {
                    activeFilters.sizes = activeFilters.sizes.filter(s => s !== size);
                    document.querySelector(`.size-box[data-size="${size}"]`)?.classList.remove('active');
                    currentPage = 1; renderPage();
                },
            ));
        });
        activeFilters.colors.forEach(color => {
            bar.appendChild(makeTag(
                `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:4px;border:1px solid #ddd;vertical-align:middle;"></span>Колір <i class="fa-solid fa-xmark"></i>`,
                () => {
                    activeFilters.colors = activeFilters.colors.filter(c => c !== color);
                    document.querySelector(`.color-dot[data-color="${color}"]`)?.classList.remove('active');
                    currentPage = 1; renderPage();
                },
            ));
        });
        if (searchQuery) {
            bar.appendChild(makeTag(
                `"${searchQuery}" <i class="fa-solid fa-xmark"></i>`,
                () => {
                    searchQuery = '';
                    const input = $('searchInput'); if (input) input.value = '';
                    currentPage = 1; renderPage();
                },
            ));
        }
    }

    function updateFilterResetBtn() {
        let btn = $('filterResetBtn');
        if (!btn) {
            const sidebar = document.querySelector('.shop-sidebar');
            if (!sidebar) return;
            btn = document.createElement('button');
            btn.id = 'filterResetBtn';
            btn.className = 'filter-reset-btn';
            btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Скинути фільтри';
            sidebar.appendChild(btn);
            btn.addEventListener('click', () => {
                activeFilters = { sizes: [], colors: [], priceMin: null, priceMax: null, collection: 'all' };
                searchQuery = '';
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
        const { layout, items } = btn.dataset;
        if (!layout || layout === currentLayout) return;
        currentLayout = layout;
        itemsPerPage = +items;
        currentPage = 1;
        viewOptions.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderPage();
    });

    loadProducts();
});

// === PRODUCT PAGE (PDP) ===

document.addEventListener('DOMContentLoaded', async () => {
    const productTitleEl = $('product-title');
    if (!productTitleEl) return;

    const hideLoader = () => $('pageLoader')?.classList.add('hidden');
    const productId = parseInt(new URLSearchParams(window.location.search).get('id'));
    if (!productId) { productTitleEl.innerText = 'Оберіть товар у магазині'; hideLoader(); return; }

    try {
        const [res, initialStock] = await Promise.all([
            fetch('./assets/data/products.json'),
            window.FascoApp?.getStock?.(productId).catch(() => null) ?? Promise.resolve(null),
        ]);
        const product = (await res.json()).find(p => p.id === productId);
        if (!product) { productTitleEl.innerText = 'Товар не знайдено'; hideLoader(); return; }

        document.title = `${product.name} - FASCO`;
        $('breadcrumb-name').innerText = product.name;
        productTitleEl.innerText = product.name;
        $('product-price').innerText = `$${product.price.toFixed(2)}`;

        const descEl = $('product-description-text');
        if (descEl && product.description) descEl.innerText = product.description;

        const deliveryEl = $('delivery-date');
        if (deliveryEl) {
            const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
            const fmt = d => `${d.getDate()} ${months[d.getMonth()]}`;
            const today = new Date();
            const start = new Date(today); start.setDate(today.getDate() + 7);
            const end = new Date(today); end.setDate(today.getDate() + 14);
            deliveryEl.innerText = `${fmt(start)} – ${fmt(end)}`;
        }

        const timerBanner = document.querySelector('.timer-banner');
        if (product.oldPrice) {
            const opEl = $('product-old-price');
            const sbEl = $('product-sale-badge');
            if (opEl) opEl.innerText = `$${product.oldPrice.toFixed(2)}`;
            if (sbEl) {
                sbEl.innerText = `Save ${Math.round((1 - product.price / product.oldPrice) * 100)}%`;
                sbEl.style.display = 'inline-block';
            }
        } else if (timerBanner) {
            timerBanner.style.display = 'none';
        }

        // Gallery
        const mainImg = $('product-main-image');
        const thumbsEl = $('product-thumbnails');

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

        // Colors + Sizes (stock у форматі { color: { size: qty } } лежить у Firestore).
        const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ONE'];
        const sortBySizeOrder = (keys) => keys.slice().sort((a, b) => {
            const ai = SIZE_ORDER.indexOf(a);
            const bi = SIZE_ORDER.indexOf(b);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
        const sizeLabel = (s) => s === 'ONE' ? 'ONE SIZE' : s;

        const sizesWrap = document.querySelector('.size-options');
        const sizeText = $('selected-size-text');
        const stockText = $('product-stock-text');
        const addBtnRef = $('addToCartBtn');
        const colorContainer = $('product-colors');
        const colorText = $('selected-color-text');

        let stockByColor = initialStock ? { ...initialStock } : {};
        let activeColor = product.swatches?.[0] || '';
        let activeSizeKey = '';

        const sizesForColor = () => stockByColor[activeColor] || {};

        function pickInitialSize() {
            const sizes = sizesForColor();
            const order = sortBySizeOrder(Object.keys(sizes));
            return order.find(s => Number(sizes[s]) > 0) || order[0] || '';
        }

        function renderStockText(size) {
            if (!stockText) return;
            if (!size) { stockText.textContent = ''; stockText.className = 'product-stock-text'; return; }
            const left = Number(sizesForColor()[size] || 0);
            if (left <= 0) { stockText.textContent = 'Розпродано'; stockText.className = 'product-stock-text is-out'; }
            else if (left <= 3) { stockText.textContent = `Залишилось ${left} шт`; stockText.className = 'product-stock-text is-low'; }
            else { stockText.textContent = `В наявності: ${left} шт`; stockText.className = 'product-stock-text'; }
        }

        function setActive(size) {
            activeSizeKey = size || '';
            if (sizeText) {
                sizeText.innerText = activeSizeKey ? sizeLabel(activeSizeKey) : '';
                sizeText.dataset.size = activeSizeKey;
            }
        }

        function updateAddBtnState() {
            if (!addBtnRef) return;
            const left = Number(sizesForColor()[activeSizeKey] || 0);
            const disabled = !activeSizeKey || left <= 0;
            addBtnRef.disabled = disabled;
            addBtnRef.classList.toggle('is-disabled', disabled);
        }

        function renderSizes() {
            if (!sizesWrap) return;
            const sizes = sizesForColor();
            const order = sortBySizeOrder(Object.keys(sizes));
            const stillAvailable = order.includes(activeSizeKey) && Number(sizes[activeSizeKey]) > 0;
            const next = stillAvailable ? activeSizeKey : pickInitialSize();
            sizesWrap.innerHTML = order.map(s => {
                const left = Number(sizes[s] || 0);
                const cls = ['size-btn'];
                if (s === next) cls.push('active');
                if (left <= 0) cls.push('is-disabled');
                if (s === 'ONE') cls.push('is-one');
                return `<button class="${cls.join(' ')}" data-size="${s}"${left <= 0 ? ' disabled' : ''}>${sizeLabel(s)}</button>`;
            }).join('');
            setActive(next);
            sizesWrap.querySelectorAll('.size-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    if (this.disabled) return;
                    sizesWrap.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    setActive(this.dataset.size);
                    renderStockText(activeSizeKey);
                    updateAddBtnState();
                });
            });
            renderStockText(activeSizeKey);
            updateAddBtnState();
        }

        if (colorContainer && product.swatches?.length) {
            colorContainer.innerHTML = product.swatches.map((color, i) =>
                `<div class="color-circle ${i === 0 ? 'active' : ''}" style="background:${color};" data-color="${color}" title="${color}"></div>`
            ).join('');
            if (colorText) colorText.innerText = activeColor;
            colorContainer.querySelectorAll('.color-circle').forEach(circle => {
                circle.addEventListener('click', function () {
                    colorContainer.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
                    this.classList.add('active');
                    activeColor = this.dataset.color;
                    if (colorText) colorText.innerText = activeColor;
                    const colorImages = product.colorImages?.[activeColor];
                    loadGallery(colorImages?.length ? colorImages : defaultImages);
                    renderSizes();
                });
            });
        }
        renderSizes();

        // Live-оновлення наявності з Firestore (поки інші клієнти купують).
        try {
            window.FascoApp?.watchStock?.(product.id, (remote) => {
                if (!remote) return;
                stockByColor = { ...remote };
                renderSizes();
            });
        } catch { /* ignore */ }

        // Quantity
        const qtyInput = $('qty-value');
        $('qty-minus')?.addEventListener('click', () => {
            if (parseInt(qtyInput.value) > 1) qtyInput.value = parseInt(qtyInput.value) - 1;
        });
        $('qty-plus')?.addEventListener('click', () => {
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
                $(`tab-${this.dataset.tab}`)?.classList.add('active');
            });
        });

        // Share
        const shareBtn = $('shareBtn');
        const shareToast = $('shareToast');
        if (shareBtn) {
            shareBtn.addEventListener('click', async e => {
                e.preventDefault();
                try { await navigator.clipboard.writeText(window.location.href); }
                catch {
                    const el = document.createElement('textarea');
                    el.value = window.location.href;
                    document.body.appendChild(el); el.select(); document.execCommand('copy');
                    document.body.removeChild(el);
                }
                if (shareToast) {
                    shareToast.classList.add('visible');
                    setTimeout(() => shareToast.classList.remove('visible'), 2500);
                }
            });
        }

        // Ask a question
        const askBtn = $('askQuestionBtn');
        const askModal = $('askModal');
        if (askBtn && askModal) {
            const askClose = askModal.querySelector('.ask-close');
            const askForm = $('askForm');
            const openAsk = () => { askModal.classList.add('open'); document.body.style.overflow = 'hidden'; };
            const closeAsk = () => {
                askModal.classList.remove('open'); askModal.classList.add('close');
                setTimeout(() => askModal.classList.remove('close'), 400);
                document.body.style.overflow = '';
            };
            askBtn.addEventListener('click', e => { e.preventDefault(); openAsk(); });
            askClose?.addEventListener('click', closeAsk);
            window.addEventListener('click', e => { if (e.target === askModal) closeAsk(); });
            askForm?.addEventListener('submit', e => { e.preventDefault(); closeAsk(); askForm.reset(); });
        }

        window._currentProduct = product;
        hideLoader();
    } catch (err) {
        console.error('Error loading product:', err);
        hideLoader();
    }

    // Sale timer
    let totalSeconds = 5 * 3600 + 59 * 60 + 47;
    const tH = $('t-h'), tM = $('t-m'), tS = $('t-s');
    if (tH && tM && tS) {
        const tick = () => {
            if (totalSeconds <= 0) return;
            totalSeconds--;
            tH.innerText = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            tM.innerText = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            tS.innerText = String(totalSeconds % 60).padStart(2, '0');
        };
        setInterval(tick, 1000); tick();
    }
});

// === CART PAGE ===

document.addEventListener('DOMContentLoaded', () => {
    const cartPageEmpty = $('cartPageEmpty');
    const cartPageContent = $('cartPageContent');
    const cartTableBody = $('cartTableBody');
    const cartPageSubtotal = $('cartPageSubtotal');
    const giftWrapCheck = $('giftWrapCheck');
    if (!cartPageEmpty || !cartPageContent || !cartTableBody) return;

    function renderCartPage() {
        const items = Cart.getItems();
        const isEmpty = items.length === 0;
        cartPageEmpty.style.display = isEmpty ? 'flex' : 'none';
        cartPageContent.style.display = isEmpty ? 'none' : 'block';
        if (isEmpty) return;

        cartTableBody.innerHTML = '';
        items.forEach((item, index) => {
            const colorDot = item.color?.startsWith('#')
                ? `<span class="cart-color-dot" style="background:${item.color};border:1px solid rgba(0,0,0,.15);display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:middle;"></span>`
                : '';
            const colorText = item.color?.startsWith('#') ? '' : (item.color || '—');

            const row = document.createElement('div');
            row.className = 'cart-page-item';
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
        if (giftWrapCheck?.checked) total += 10;
        if (cartPageSubtotal) cartPageSubtotal.innerText = `$${total.toFixed(2)}`;
    }

    if (giftWrapCheck) {
        try { giftWrapCheck.checked = localStorage.getItem('fasco_giftwrap') === '1'; } catch { /* ignore */ }
        giftWrapCheck.addEventListener('change', () => {
            try { localStorage.setItem('fasco_giftwrap', giftWrapCheck.checked ? '1' : '0'); } catch { /* ignore */ }
            updateSubtotal();
        });
        updateSubtotal();
    }

    renderCartPage();
    window.addEventListener('fasco:remote-sync', renderCartPage);
});

// === DEAL GALLERY (desktop swiper) ===

document.addEventListener('DOMContentLoaded', () => {
    const gallery = $('dealGallery');
    const track = $('dealTrack');
    const prevBtn = $('dealPrev');
    const nextBtn = $('dealNext');
    if (!gallery || !track || !prevBtn || !nextBtn) return;

    const dots = $('dealDots');
    const dotEls = dots ? [...dots.querySelectorAll('div')] : [];
    const slideNum = $('dealSlideNum');
    const saleName = $('dealSaleName');
    const discount = $('dealDiscount');
    const saleBox = gallery.querySelector('.sale-box');
    const total = track.querySelectorAll('.deal-slide').length;
    let currentIndex = 0;
    let isSliding = false;
    const ANIM_MS = 550;

    const getStep = () => {
        const first = track.firstElementChild;
        if (!first) return 0;
        const w = first.getBoundingClientRect().width;
        const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || 0) || 0;
        return w + gap;
    };

    const syncSaleBox = () => {
        const first = track.firstElementChild;
        if (!first) return;
        if (slideNum) slideNum.textContent = (currentIndex % total) + 1;
        if (saleName && first.dataset.name) saleName.textContent = first.dataset.name;
        if (discount && first.dataset.discount) discount.textContent = `ЗНИЖКА ${first.dataset.discount}%`;
    };

    const syncDots = () => {
        const idx = ((currentIndex % total) + total) % total;
        dotEls.forEach((d, i) => d.classList.toggle('progress-highlight', i === idx));
    };

    function next() {
        if (isSliding) return;
        isSliding = true;
        const step = getStep();
        const slides = track.children;
        slides[1]?.classList.add('is-active');
        saleBox?.classList.add('is-fading');
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
            syncSaleBox(); syncDots();
            saleBox?.classList.remove('is-fading');
            isSliding = false;
        }, ANIM_MS + 20);
    }

    function prev() {
        if (isSliding) return;
        isSliding = true;
        const step = getStep();
        const last = track.lastElementChild;
        if (!last) { isSliding = false; return; }
        track.style.transition = 'none';
        last.style.transition = 'none';
        track.insertBefore(last, track.firstElementChild);
        last.classList.add('is-active');
        track.style.transform = `translateX(-${step}px)`;
        void track.offsetHeight;
        last.style.transition = '';
        saleBox?.classList.add('is-fading');
        // Подвійний rAF: спочатку фіксуємо стартовий transform -step,
        // потім вмикаємо анімацію назад до 0.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            track.style.transition = `transform ${ANIM_MS}ms cubic-bezier(.4, 0, .2, 1)`;
            track.style.transform = 'translateX(0)';
        }));
        setTimeout(() => {
            track.children[1]?.classList.remove('is-active');
            track.style.transition = 'none';
            currentIndex = ((currentIndex - 1) % total + total) % total;
            syncSaleBox(); syncDots();
            saleBox?.classList.remove('is-fading');
            isSliding = false;
        }, ANIM_MS + 60);
    }

    nextBtn.addEventListener('click', next);
    prevBtn.addEventListener('click', prev);

    dotEls.forEach((dot, i) => dot.addEventListener('click', () => {
        if (isSliding) return;
        const cur = ((currentIndex % total) + total) % total;
        let diff = (i - cur + total) % total;
        if (!diff) return;
        const stepFwd = () => {
            if (diff <= 0) return;
            diff--; next();
            if (diff > 0) setTimeout(stepFwd, 600);
        };
        stepFwd();
    }));

    let autoPlay = setInterval(next, 5000);
    gallery.addEventListener('mouseenter', () => clearInterval(autoPlay));
    gallery.addEventListener('mouseleave', () => {
        clearInterval(autoPlay);
        autoPlay = setInterval(next, 5000);
    });

    let touchStartX = 0;
    gallery.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    gallery.addEventListener('touchend', e => {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) (diff > 0 ? next : prev)();
    });
});

// === SEASON DEAL COUNTDOWN ===

document.addEventListener('DOMContentLoaded', () => {
    const dEl = $('timerDays'), hEl = $('timerHours'), mEl = $('timerMinutes'), sEl = $('timerSeconds');
    if (!dEl || !hEl || !mEl || !sEl) return;

    // Зберігаємо кінцевий час у localStorage, щоб таймер не скидався при перезавантаженні.
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

// === INSTAGRAM SCROLL GALLERY ===

document.addEventListener('DOMContentLoaded', () => {
    const gallery = $('instaGallery');
    if (!gallery) return;

    const origImgs = [...gallery.querySelectorAll('img')];
    const total = origImgs.length;
    origImgs.forEach(img => gallery.appendChild(img.cloneNode(true)));

    let offset = 0;
    let isAnimating = false;
    const getStep = () => window.innerWidth >= 1024 ? 100 / 7 : 100 / 3;

    function shift(dir) {
        if (isAnimating) return;
        isAnimating = true;
        offset = (offset + dir + total * 100) % total;
        gallery.classList.add('is-animating');
        gallery.style.transform = `translateX(-${offset * getStep()}%)`;
        setTimeout(() => {
            gallery.classList.remove('is-animating');
            isAnimating = false;
        }, 730);
    }

    const section = gallery.closest('.instagram');
    if (!section) return;

    let lastY = window.scrollY;
    let accumY = 0;
    const THRESH = 110;

    window.addEventListener('scroll', () => {
        const rect = section.getBoundingClientRect();
        if (rect.top > window.innerHeight || rect.bottom < 0) {
            lastY = window.scrollY; accumY = 0; return;
        }
        accumY += window.scrollY - lastY;
        lastY = window.scrollY;
        if (accumY >= THRESH) { shift(1); accumY = 0; }
        else if (accumY <= -THRESH) { shift(-1); accumY = 0; }
    }, { passive: true });
});

// === CHECKOUT PAGE ===

(function () {
    const STORAGE_KEY = 'fasco_cart';
    const SHIPPING_THRESHOLD = 75;
    const SHIPPING_FEE = 9.99;

    const DEMO_ITEMS = [
        { id: 'demo-1', name: 'Сукня міні з рюшами на бретелях', price: 108, qty: 1, size: 'M', color: 'Червоний', image: './assets/images/new-1.webp' },
        { id: 'demo-2', name: 'Льняна сорочка з довгим рукавом', price: 32, qty: 1, size: 'L', color: 'Бежевий', image: './assets/images/new-2.webp' },
    ];

    const loadItems = () => {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (Array.isArray(raw) && raw.length) return raw;
        } catch { /* ignore */ }
        return DEMO_ITEMS;
    };
    const fmt = (n) => '$' + (Math.round(n * 100) / 100).toFixed(2);
    const getGiftWrap = () => {
        try { return localStorage.getItem('fasco_giftwrap') === '1'; } catch { return false; }
    };

    let items = loadItems();
    let promoPercent = 0;

    function renderItems() {
        const wrap = $('checkoutSummaryItems');
        if (!wrap) return;
        wrap.innerHTML = items.map(it => {
            const meta = [it.size && `Розмір: ${it.size}`, it.color && `Колір: ${it.color}`].filter(Boolean).join(' • ');
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
                    <div class="cs-price">${fmt(it.price * it.qty)}</div>
                </div>`;
        }).join('');
    }

    function calcTotals() {
        const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
        const discount = +(subtotal * (promoPercent / 100)).toFixed(2);
        const giftWrap = getGiftWrap() && items.length ? 10 : 0;
        const subAfter = subtotal - discount;
        const shipping = !items.length ? 0 : (subAfter >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);
        const total = +(subAfter + shipping + giftWrap).toFixed(2);
        return { subtotal, discount, giftWrap, shipping, total };
    }

    function renderTotals() {
        const t = calcTotals();
        if ($('ckSubtotal')) $('ckSubtotal').textContent = fmt(t.subtotal);

        const discountRow = $('ckDiscountRow');
        if (discountRow) {
            discountRow.style.display = promoPercent > 0 ? '' : 'none';
            if (promoPercent > 0 && $('ckDiscount')) $('ckDiscount').textContent = '-' + fmt(t.discount);
        }
        const giftRow = $('ckGiftWrapRow');
        if (giftRow) {
            giftRow.style.display = t.giftWrap > 0 ? '' : 'none';
            if (t.giftWrap > 0 && $('ckGiftWrap')) $('ckGiftWrap').textContent = fmt(t.giftWrap);
        }
        if ($('ckShipping')) $('ckShipping').textContent = t.shipping === 0 ? 'Безкоштовно' : fmt(t.shipping);
        if ($('ckTotal')) $('ckTotal').textContent = fmt(t.total);
    }

    function applyPromo() {
        const input = $('ck-promo');
        const msg = $('ckPromoMsg');
        if (!input || !msg) return;
        const code = input.value.trim().toLowerCase();
        const codes = { 'fasco10': 10, 'fasco20': 20, 'first5': 5 };

        if (!code) {
            promoPercent = 0; msg.textContent = ''; msg.className = 'checkout-promo-msg';
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

    function bindPaymentMethods() {
        const radios = document.querySelectorAll('input[name="payment-method"]');
        const cardFields = $('paymentCardFields');
        if (!cardFields || !radios.length) return;

        const update = () => {
            const checked = document.querySelector('input[name="payment-method"]:checked');
            cardFields.hidden = !(checked && checked.value === 'card');
            document.querySelectorAll('.payment-method').forEach(el => {
                el.classList.toggle('is-active', el.contains(checked));
            });
        };
        radios.forEach(r => r.addEventListener('change', update));
        update();
    }

    function bindMasks() {
        const num = $('ck-cardnum');
        num?.addEventListener('input', () => {
            const v = num.value.replace(/\D/g, '').slice(0, 19);
            num.value = v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
        });
        const exp = $('ck-exp');
        exp?.addEventListener('input', () => {
            let v = exp.value.replace(/\D/g, '').slice(0, 4);
            if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
            exp.value = v;
        });
        const cvc = $('ck-cvc');
        cvc?.addEventListener('input', () => { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });
        const postal = $('ck-postal');
        postal?.addEventListener('input', () => { postal.value = postal.value.replace(/[^\dA-Za-z\s-]/g, '').slice(0, 10); });
    }

    function bindSubmit() {
        const form = $('checkoutForm');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const required = ['ck-email', 'ck-country', 'ck-firstname', 'ck-lastname', 'ck-address', 'ck-city', 'ck-postal'];
            let firstInvalid = null;
            for (const id of required) {
                const el = $(id);
                if (!el) continue;
                if (!el.value || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value))) {
                    el.classList.add('is-invalid');
                    firstInvalid ??= el;
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
            const original = btn?.innerHTML;
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Зберігаємо…</span>';
            }

            const orderItems = items || [];
            const t = calcTotals();
            const promoCode = ($('ck-promo')?.value || '').trim().toLowerCase();

            const order = {
                items: orderItems,
                contact: {
                    email: ($('ck-email')?.value || '').trim(),
                    country: ($('ck-country')?.value || '').trim(),
                    firstName: ($('ck-firstname')?.value || '').trim(),
                    lastName: ($('ck-lastname')?.value || '').trim(),
                    address: ($('ck-address')?.value || '').trim(),
                    city: ($('ck-city')?.value || '').trim(),
                    postal: ($('ck-postal')?.value || '').trim(),
                    phone: ($('ck-phone')?.value || '').trim(),
                },
                totals: {
                    subtotal: +t.subtotal.toFixed(2),
                    discount: t.discount,
                    promoPercent,
                    promoCode: promoPercent > 0 ? promoCode : '',
                    giftWrap: t.giftWrap,
                    shipping: t.shipping,
                    total: t.total,
                    currency: 'USD',
                },
                paymentMethod: form.querySelector('input[name="payment-method"]:checked')?.value || 'card',
                marketingOptIn: !!document.querySelector('.checkout-block input[type="checkbox"]:not([id])')?.checked,
            };

            // Атомарне списання stock перед збереженням замовлення:
            // якщо когось випередили — кидаємо помилку, кошик не очищаємо.
            try {
                await window.FascoApp?.decrementStock?.(orderItems);
            } catch (err) {
                if (btn) { btn.disabled = false; btn.innerHTML = original; }
                alert(err?.message || 'Не вдалося оформити замовлення: товар закінчився.');
                return;
            }

            if ($('ck-save-info')?.checked && window.FascoApp?.updateUserProfile) {
                try {
                    await window.FascoApp.updateUserProfile({
                        firstName: order.contact.firstName,
                        lastName: order.contact.lastName,
                        phone: order.contact.phone,
                        address: order.contact.address,
                        city: order.contact.city,
                        country: order.contact.country,
                        postal: order.contact.postal,
                    });
                } catch (e) { console.warn('[Fasco] save-info failed', e); }
            }

            let orderId = null;
            try { orderId = await window.FascoApp?.saveOrder?.(order); }
            catch (err) { console.warn('[Fasco] order save failed', err); }

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
                localStorage.removeItem('fasco_giftwrap');
                Cart.reload?.();
                window.FascoApp?.notifyCartChanged?.();
            } catch { /* ignore */ }

            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>Замовлення оформлено</span>';
                btn.style.background = '#2e8b57';
            }

            showOrderSuccessModal(orderId, order);
        });
    }

    // Модалка успіху після оформлення (замість alert).
    function showOrderSuccessModal(orderId, order) {
        const shortId = orderId ? String(orderId).slice(0, 8).toUpperCase() : null;
        const total = order?.totals?.total ?? null;
        const overlay = document.createElement('div');
        overlay.className = 'order-success-overlay';
        overlay.innerHTML = `
            <div class="order-success-modal" role="dialog" aria-modal="true">
                <div class="order-success-icon"><i class="fa-solid fa-circle-check"></i></div>
                <h2 class="order-success-title">Оплачено</h2>
                <p class="order-success-text">Дякуємо за покупку! Ми надішлемо підтвердження на вашу пошту.</p>
                ${shortId ? `<div class="order-success-id">
                    <span class="order-success-id-label">Номер замовлення</span>
                    <span class="order-success-id-value">#${shortId}</span>
                </div>` : ''}
                ${total != null ? `<div class="order-success-total">
                    <span>Сплачено:</span> <strong>$${Number(total).toFixed(2)}</strong>
                </div>` : ''}
                <div class="order-success-actions">
                    <button type="button" class="btn order-success-btn-primary" data-action="home">На головну</button>
                    <button type="button" class="order-success-btn-secondary" data-action="orders">Мої замовлення</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('is-open'));

        const close = () => {
            overlay.classList.remove('is-open');
            setTimeout(() => overlay.remove(), 200);
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'home') { close(); location.href = 'index.html'; }
            if (action === 'orders') {
                close();
                sessionStorage.setItem('fasco_open_orders', '1');
                location.href = 'index.html';
            }
        });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
        });
    }

    function fillFromProfile(user, profile) {
        if (!user) return;
        const p = profile?.profile || {};
        const set = (id, val) => { const el = $(id); if (el && !el.value && val) el.value = val; };
        set('ck-email', user.email || '');
        set('ck-firstname', p.firstName || user.displayName?.split(' ')[0] || '');
        set('ck-lastname', p.lastName || user.displayName?.split(' ').slice(1).join(' ') || '');
        set('ck-address', p.address || '');
        set('ck-city', p.city || '');
        set('ck-country', p.country || '');
        set('ck-postal', p.postal || '');
        set('ck-phone', p.phone || user.phoneNumber || '');
        document.querySelectorAll('.checkout-account-link').forEach(el => { el.style.display = 'none'; });
    }

    function init() {
        renderItems();
        renderTotals();
        bindPaymentMethods();
        bindMasks();
        bindSubmit();
        $('ck-promo-apply')?.addEventListener('click', applyPromo);
        $('ck-promo')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); applyPromo(); }
        });
        window.addEventListener('fasco:remote-sync', () => {
            items = loadItems();
            renderItems();
            renderTotals();
        });
        const tryFill = () => {
            if (window.FascoApp) window.FascoApp.onAuthChanged(fillFromProfile);
            else window.addEventListener('fasco:ready', tryFill, { once: true });
        };
        tryFill();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

// === USER UI — аватарка + модалка профілю / замовлень ===

(function () {
    const PROFILE_MODAL_ID = 'profileModal';

    function initials(profile, user) {
        const fn = profile?.profile?.firstName || user?.displayName?.split(' ')[0] || '';
        const ln = profile?.profile?.lastName || user?.displayName?.split(' ').slice(1).join(' ') || '';
        const fromName = `${fn[0] || ''}${ln[0] || ''}`.toUpperCase();
        if (fromName) return fromName;
        return (user?.email?.[0] || 'U').toUpperCase();
    }

    function renderHeaderAvatar(user, profile) {
        const wrapper = $('userToolWrapper');
        if (!wrapper) return;
        if (!user) {
            wrapper.innerHTML = '<a href="signin.html" id="userToolBtn" aria-label="Акаунт"><i class="fa-regular fa-user"></i></a>';
            return;
        }
        const photo = user.photoURL || profile?.profile?.photoURL;
        const inner = photo
            ? `<img src="${photo}" alt="" referrerpolicy="no-referrer">`
            : `<span class="user-avatar-initials">${initials(profile, user)}</span>`;
        wrapper.innerHTML = `<button type="button" class="user-avatar-btn" id="userToolBtn" aria-label="Профіль">${inner}</button>`;
        wrapper.querySelector('#userToolBtn')?.addEventListener('click', openProfileModal);
    }

    function renderMobileAuth(user, profile) {
        const section = $('mobileAuthSection');
        if (!section) return;
        if (!user) {
            section.innerHTML =
                '<a href="signin.html" class="mobile-menu-login"><i class="fa-regular fa-user"></i><span>Увійти</span></a>' +
                '<a href="signup.html" class="mobile-menu-register"><i class="fa-solid fa-user-plus"></i><span>Зареєструватися</span></a>';
            return;
        }
        const fn = profile?.profile?.firstName || user.displayName?.split(' ')[0] || '';
        const ln = profile?.profile?.lastName || user.displayName?.split(' ').slice(1).join(' ') || '';
        const name = `${fn} ${ln}`.trim() || (user.email || 'Користувач');
        section.innerHTML =
            `<button type="button" class="mobile-menu-login" id="mobileProfileBtn"><i class="fa-regular fa-user"></i><span>${name}</span></button>` +
            '<button type="button" class="mobile-menu-register" id="mobileLogoutBtn"><i class="fa-solid fa-right-from-bracket"></i><span>Вийти</span></button>';
        $('mobileProfileBtn')?.addEventListener('click', () => {
            $('mobileMenuOverlay')?.classList.remove('visible');
            $('mobileMenuPanel')?.classList.remove('open');
            openProfileModal();
        });
        $('mobileLogoutBtn')?.addEventListener('click', () => window.FascoApp?.logout?.());
    }

    function ensureModal() {
        let m = $(PROFILE_MODAL_ID);
        if (m) return m;
        m = document.createElement('div');
        m.id = PROFILE_MODAL_ID;
        m.className = 'profile-modal';
        m.innerHTML = `
        <div class="profile-modal-backdrop"></div>
        <div class="profile-modal-panel" role="dialog" aria-labelledby="profileModalTitle">
            <div class="profile-modal-header">
                <div class="profile-modal-avatar">
                    <img id="profileModalPhoto" alt="" referrerpolicy="no-referrer" style="display:none;">
                    <span id="profileModalInitials">U</span>
                </div>
                <div class="profile-modal-meta">
                    <h3 id="profileModalTitle">Профіль</h3>
                    <p id="profileModalEmail"></p>
                </div>
                <button type="button" class="profile-modal-close" aria-label="Закрити">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="profile-modal-tabs" role="tablist">
                <button type="button" class="profile-tab is-active" data-tab="profile" role="tab">Профіль</button>
                <button type="button" class="profile-tab" data-tab="orders" role="tab">Мої замовлення</button>
            </div>
            <form class="profile-modal-form profile-tab-pane is-active" data-pane="profile" id="profileModalForm">
                <div class="profile-row">
                    <label>Імʼя<input type="text" name="firstName" autocomplete="given-name"></label>
                    <label>Прізвище<input type="text" name="lastName" autocomplete="family-name"></label>
                </div>
                <label>Email<input type="email" name="email" autocomplete="email" disabled></label>
                <label>Телефон<input type="tel" name="phone" autocomplete="tel"></label>
                <label>Адреса<input type="text" name="address" autocomplete="street-address"></label>
                <div class="profile-row">
                    <label>Місто<input type="text" name="city" autocomplete="address-level2"></label>
                    <label>Країна<input type="text" name="country" autocomplete="country-name"></label>
                </div>
                <div class="profile-modal-actions">
                    <button type="button" class="profile-modal-logout" id="profileModalLogout">
                        <i class="fa-solid fa-right-from-bracket"></i> Вийти
                    </button>
                    <button type="submit" class="btn profile-modal-save">Зберегти</button>
                </div>
                <p class="profile-modal-status" id="profileModalStatus" aria-live="polite"></p>
            </form>
            <div class="profile-tab-pane profile-orders" data-pane="orders" id="profileOrdersPane">
                <p class="profile-orders-empty">Завантажуємо…</p>
            </div>
        </div>`;
        document.body.appendChild(m);

        m.querySelector('.profile-modal-backdrop').addEventListener('click', closeProfileModal);
        m.querySelector('.profile-modal-close').addEventListener('click', closeProfileModal);
        m.querySelector('#profileModalLogout').addEventListener('click', async () => {
            await window.FascoApp?.logout?.();
            closeProfileModal();
        });
        m.querySelector('#profileModalForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const status = m.querySelector('#profileModalStatus');
            const btn = form.querySelector('.profile-modal-save');
            btn.disabled = true;
            status.textContent = 'Зберігаємо…';
            status.className = 'profile-modal-status';
            try {
                const data = Object.fromEntries(new FormData(form).entries());
                delete data.email;
                await window.FascoApp?.updateUserProfile?.(data);
                status.textContent = 'Збережено!';
                status.classList.add('ok');
            } catch (err) {
                status.textContent = err?.message || 'Помилка збереження.';
                status.classList.add('err');
            } finally {
                btn.disabled = false;
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && m.classList.contains('open')) closeProfileModal();
        });
        m.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const name = tab.dataset.tab;
                m.querySelectorAll('.profile-tab').forEach(t => t.classList.toggle('is-active', t === tab));
                m.querySelectorAll('.profile-tab-pane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === name));
                if (name === 'orders') loadOrders();
            });
        });
        return m;
    }

    const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;
    const fmtDate = (ts) => {
        try {
            const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
            return d ? d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        } catch { return ''; }
    };
    const paymentLabel = (p) => ({ card: 'Картка', apple: 'Apple Pay', cod: 'Готівка при отриманні' }[p] || p || '—');
    const statusLabel = (s) => ({ new: 'Оплачено', paid: 'Оплачено', shipped: 'Відправлено', done: 'Виконано', cancelled: 'Скасовано' }[s] || s || 'Оплачено');

    async function loadOrders() {
        const pane = $('profileOrdersPane');
        if (!pane) return;
        pane.innerHTML = '<p class="profile-orders-empty">Завантажуємо…</p>';
        try {
            const orders = (await window.FascoApp?.listMyOrders?.()) || [];
            if (!orders.length) {
                pane.innerHTML = '<p class="profile-orders-empty">У вас ще немає замовлень.</p>';
                return;
            }
            pane.innerHTML = orders.map(o => {
                const t = o.totals || {};
                const itemsHtml = (o.items || []).map(it => `
                    <div class="order-item">
                        <img src="${it.image || './assets/images/shop_icon.webp'}" alt="">
                        <div>
                            <p class="order-item-name">${it.name || ''}</p>
                            <p class="order-item-meta">${[it.size && 'Розмір: ' + it.size, it.color && 'Колір: ' + it.color].filter(Boolean).join(' • ')}</p>
                        </div>
                        <span class="order-item-qty">×${it.qty || 1}</span>
                        <span class="order-item-price">${fmtMoney((it.price || 0) * (it.qty || 0))}</span>
                    </div>`).join('');
                const promo = t.promoCode ? ` <span class="order-promo">(${t.promoCode} −${t.promoPercent}%)</span>` : '';
                return `
                    <article class="order-card">
                        <header class="order-card-head">
                            <div>
                                <p class="order-id">#${String(o.id).slice(0, 8)}</p>
                                <p class="order-date">${fmtDate(o.createdAt)}</p>
                            </div>
                            <span class="order-status order-status-${o.status || 'new'}">${statusLabel(o.status)}</span>
                        </header>
                        <div class="order-items">${itemsHtml}</div>
                        <footer class="order-card-foot">
                            <div class="order-totals">
                                <p><span>Підсумок</span><span>${fmtMoney(t.subtotal)}</span></p>
                                ${t.discount ? `<p><span>Знижка${promo}</span><span>−${fmtMoney(t.discount)}</span></p>` : ''}
                                ${t.giftWrap ? `<p><span>Упаковка</span><span>${fmtMoney(t.giftWrap)}</span></p>` : ''}
                                <p><span>Доставка</span><span>${t.shipping ? fmtMoney(t.shipping) : 'Безкоштовно'}</span></p>
                                <p class="order-total"><span>Разом</span><span>${fmtMoney(t.total)}</span></p>
                            </div>
                            <div class="order-meta">
                                <p>Оплата: <strong>${paymentLabel(o.paymentMethod)}</strong></p>
                                <p>${o.contact?.city || ''}${o.contact?.country ? ', ' + o.contact.country : ''}</p>
                            </div>
                        </footer>
                    </article>`;
            }).join('');
        } catch (err) {
            console.warn('[Fasco] loadOrders error', err);
            pane.innerHTML = '<p class="profile-orders-empty">Не вдалося завантажити замовлення.</p>';
        }
    }

    function openProfileModal() {
        const user = window.FascoApp?.user;
        if (!user) { location.href = 'signin.html'; return; }
        const profile = window.FascoApp?.profile;
        const m = ensureModal();
        const photo = user.photoURL || profile?.profile?.photoURL;
        const photoEl = m.querySelector('#profileModalPhoto');
        const initEl = m.querySelector('#profileModalInitials');
        if (photo) {
            photoEl.src = photo;
            photoEl.style.display = '';
            initEl.style.display = 'none';
        } else {
            photoEl.style.display = 'none';
            initEl.style.display = '';
            initEl.textContent = initials(profile, user);
        }
        const fn = profile?.profile?.firstName || user.displayName?.split(' ')[0] || '';
        const ln = profile?.profile?.lastName || user.displayName?.split(' ').slice(1).join(' ') || '';
        m.querySelector('#profileModalTitle').textContent = `${fn} ${ln}`.trim() || 'Профіль';
        m.querySelector('#profileModalEmail').textContent = user.email || '';
        const f = m.querySelector('#profileModalForm');
        f.firstName.value = fn;
        f.lastName.value = ln;
        f.email.value = user.email || '';
        f.phone.value = profile?.profile?.phone || user.phoneNumber || '';
        f.address.value = profile?.profile?.address || '';
        f.city.value = profile?.profile?.city || '';
        f.country.value = profile?.profile?.country || '';
        m.querySelector('#profileModalStatus').textContent = '';
        m.querySelectorAll('.profile-tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === 'profile'));
        m.querySelectorAll('.profile-tab-pane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === 'profile'));
        m.classList.add('open');
        document.body.classList.add('no-scroll');
    }

    function closeProfileModal() {
        const m = $(PROFILE_MODAL_ID);
        if (!m) return;
        m.classList.remove('open');
        document.body.classList.remove('no-scroll');
    }

    function bind() {
        if (!window.FascoApp) {
            window.addEventListener('fasco:ready', bind, { once: true });
            return;
        }
        window.FascoApp.onAuthChanged((user, profile) => {
            renderHeaderAvatar(user, profile);
            renderMobileAuth(user, profile);
            // Після checkout — відкриваємо модалку профілю на вкладці "Замовлення".
            if (user && sessionStorage.getItem('fasco_open_orders') === '1') {
                sessionStorage.removeItem('fasco_open_orders');
                setTimeout(() => {
                    openProfileModal();
                    $(PROFILE_MODAL_ID)?.querySelector('.profile-tab[data-tab="orders"]')?.click();
                }, 200);
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
})();

// === NAV DROPDOWN (desktop click + mobile accordion) ===

(function initNavDropdown() {
    function bind() {
        document.querySelectorAll('.desktop-nav-links .has-dropdown').forEach(item => {
            const trigger = item.querySelector('.dropdown-trigger');
            if (!trigger) return;
            trigger.addEventListener('click', e => {
                e.preventDefault();
                const isOpen = item.classList.toggle('open');
                trigger.setAttribute('aria-expanded', String(isOpen));
                document.querySelectorAll('.desktop-nav-links .has-dropdown.open')
                    .forEach(other => { if (other !== item) other.classList.remove('open'); });
            });
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('.desktop-nav-links .has-dropdown')) {
                document.querySelectorAll('.desktop-nav-links .has-dropdown.open')
                    .forEach(item => item.classList.remove('open'));
            }
        });
        document.querySelectorAll('.mobile-menu-collapse').forEach(group => {
            const toggle = group.querySelector('.mobile-menu-toggle');
            if (!toggle) return;
            toggle.addEventListener('click', () => {
                const isOpen = group.classList.toggle('open');
                toggle.setAttribute('aria-expanded', String(isOpen));
            });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
})();

// === SUBSCRIBE TOAST ===

(function initSubscribeToast() {
    function showToast(kind, title, message) {
        const isError = kind === 'error';
        let toast = $('subscribeToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'subscribeToast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.innerHTML =
                '<i class="subscribe-toast-icon" aria-hidden="true"></i>' +
                '<div>' +
                    '<strong class="subscribe-toast-title"></strong>' +
                    '<span class="subscribe-toast-text"></span>' +
                '</div>';
            document.body.appendChild(toast);
        }
        toast.className = 'subscribe-toast' + (isError ? ' is-error' : '');
        const icon = toast.querySelector('.subscribe-toast-icon');
        if (icon) icon.className = 'subscribe-toast-icon fa-solid ' + (isError ? 'fa-circle-xmark' : 'fa-circle-check');
        toast.querySelector('.subscribe-toast-title').textContent = title;
        toast.querySelector('.subscribe-toast-text').textContent = message;
        toast.classList.add('visible');
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
    }

    const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

    function bind() {
        const section = document.querySelector('.subscribe');
        if (!section) return;
        const form = section.querySelector('form');
        const input = section.querySelector('input.company-email');
        const submitLink = section.querySelector('.btn-subscribe');
        if (!form || !input) return;

        function handleSubmit() {
            const email = (input.value || '').trim();
            if (!isValidEmail(email)) {
                input.focus();
                input.classList.add('is-invalid');
                showToast('error', 'Невірний email',
                    email ? 'Перевірте формат — має бути на кшталт name@example.com.' : 'Введіть, будь ласка, вашу email-адресу.');
                return;
            }
            input.classList.remove('is-invalid');
            showToast('success', 'Дякуємо за підписку!', 'Ми надішлемо вам новини про колекції та знижки на вказану пошту.');
            input.value = '';
            input.blur();
        }

        input.addEventListener('input', () => input.classList.remove('is-invalid'));
        form.addEventListener('submit', e => { e.preventDefault(); handleSubmit(); });
        submitLink?.addEventListener('click', e => { e.preventDefault(); handleSubmit(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
})();
