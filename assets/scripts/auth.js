const FB_ERRORS = {
    'auth/invalid-email': 'Некоректна електронна пошта.',
    'auth/missing-password': 'Введіть пароль.',
    'auth/weak-password': 'Пароль закороткий — мінімум 6 символів.',
    'auth/email-already-in-use': 'Користувач із такою поштою вже існує.',
    'auth/invalid-credential': 'Невірна пошта або пароль.',
    'auth/user-not-found': 'Користувача з такою поштою не знайдено.',
    'auth/wrong-password': 'Невірний пароль.',
    'auth/too-many-requests': 'Забагато спроб. Спробуйте пізніше.',
    'auth/popup-closed-by-user': 'Вікно входу через Google було закрито.',
    'auth/popup-blocked': 'Браузер заблокував вспливаюче вікно. Дозвольте попапи для цього сайту і спробуйте ще раз.',
    'auth/cancelled-popup-request': '',
    'auth/operation-not-allowed': 'Вхід через Google не увімкнений у Firebase Console (Authentication → Sign-in method → Google).',
    'auth/unauthorized-domain': 'Домен localhost не додано в Firebase → Authentication → Settings → Authorized domains.',
    'auth/account-exists-with-different-credential': 'Цей email вже використовується з іншим способом входу. Увійдіть через пошту та пароль.',
    'auth/network-request-failed': 'Проблема з мережею. Перевірте підключення.',
};

function showError(form, message) {
    let box = form.querySelector('.auth-error');
    if (!box) {
        box = document.createElement('div');
        box.className = 'auth-error';
        form.prepend(box);
    }
    box.textContent = message || 'Сталася помилка. Спробуйте ще раз.';
    box.classList.add('visible');
}

function clearError(form) {
    form.querySelector('.auth-error')?.classList.remove('visible');
}

function setBusy(form, busy) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = busy;
    btn.dataset.label ??= btn.textContent;
    btn.textContent = busy ? 'Зачекайте…' : btn.dataset.label;
}

function fbErrorToText(err) {
    const code = err?.code || '';
    if (code in FB_ERRORS) return FB_ERRORS[code];
    return err?.message || 'Сталася помилка. Спробуйте ще раз.';
}

function whenReady() {
    if (window.FascoApp) return Promise.resolve();
    return new Promise(res => window.addEventListener('fasco:ready', () => res(), { once: true }));
}

// Кнопка "через Email" — просто фокус на потрібному полі.
function bindEmailFocus(btnSelector, inputSelector) {
    const btn = document.querySelector(btnSelector);
    const input = document.querySelector(inputSelector);
    if (!btn || !input) return;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus({ preventScroll: true });
    });
}

function bindGoogle(googleBtn, fallbackForm) {
    if (!googleBtn) return;
    googleBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const errTarget = fallbackForm || document.querySelector('.auth-form-content');
        clearError(errTarget);
        try {
            await window.FascoApp.signInGoogle();
            location.href = 'index.html';
        } catch (err) {
            const text = fbErrorToText(err);
            if (text) showError(errTarget, text);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await whenReady();
    const page = location.pathname.split('/').pop().toLowerCase();

    if (page.includes('signin')) {
        const form = document.querySelector('form');
        bindEmailFocus('.social-btn-email', '#email');
        bindGoogle(document.querySelector('.social-btn-google'), form);
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError(form);
            setBusy(form, true);
            try {
                await window.FascoApp.signInEmail({
                    email: form.querySelector('#email').value.trim(),
                    password: form.querySelector('#password').value,
                });
                location.href = 'index.html';
            } catch (err) { showError(form, fbErrorToText(err)); }
            finally { setBusy(form, false); }
        });
    }

    if (page === 'signup.html') {
        const form = document.querySelector('form');
        bindEmailFocus('.social-btn-email', '#first-name');
        bindGoogle(document.querySelector('.social-btn-google'), form);
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError(form);
            const data = {
                firstName: form.querySelector('#first-name').value.trim(),
                lastName: form.querySelector('#last-name').value.trim(),
                email: form.querySelector('#email').value.trim(),
                phone: form.querySelector('#phone').value.trim(),
                password: form.querySelector('#password').value,
            };
            const confirm = form.querySelector('#confirm-password').value;
            if (data.password !== confirm) return showError(form, 'Паролі не співпадають.');
            if (data.password.length < 6) return showError(form, 'Пароль закороткий — мінімум 6 символів.');
            setBusy(form, true);
            try {
                await window.FascoApp.signUpWithEmail(data);
                location.href = 'index.html';
            } catch (err) { showError(form, fbErrorToText(err)); }
            finally { setBusy(form, false); }
        });
    }

    if (page === 'forgetpassword.html') {
        const form = document.querySelector('form');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError(form);
            setBusy(form, true);
            try {
                const emailEl = form.querySelector('#email');
                const email = emailEl.value.trim();
                await window.FascoApp.resetPassword(email);
                let ok = form.querySelector('.auth-success');
                if (!ok) {
                    ok = document.createElement('div');
                    ok.className = 'auth-success';
                    form.prepend(ok);
                }
                ok.textContent = `Лист для відновлення пароля надіслано на ${email}. Перевірте вашу пошту (включаючи "Спам").`;
                ok.classList.add('visible');
                emailEl.value = '';
            } catch (err) { showError(form, fbErrorToText(err)); }
            finally { setBusy(form, false); }
        });
    }
});
