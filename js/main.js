document.addEventListener('DOMContentLoaded', () => {
    const registrationSection = document.getElementById('registration');
    const form = document.getElementById('registration-form');
    const message = document.getElementById('form-message');
    const registerButtons = document.querySelectorAll('.btn-register');
    const purposeButtons = document.querySelectorAll('[data-purpose]');
    const selectedTariffName = document.getElementById('selected-tariff-name');
    let formStarted = false;

    const trackEvent = (eventName, params = {}) => {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: eventName, ...params });

        if (typeof window.clarity === 'function') {
            window.clarity('event', eventName);
            if (params.tariff) {
                window.clarity('set', 'selected_tariff', params.tariff);
            }
        }
    };

    if (form) {
        const botSessionInput = form.elements.namedItem('bot_session_id');
        const botSessionFromUrl = new URLSearchParams(window.location.search).get('bot_session_id');

        if (botSessionInput instanceof HTMLInputElement && botSessionFromUrl) {
            botSessionInput.value = botSessionFromUrl;
        }
    }

    registerButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (!registrationSection || !form) return;

            const tariff = button.dataset.tariff || '';
            const price = button.dataset.price || '';
            const placement = button.dataset.placement || 'unknown';
            const purpose = form.elements.namedItem('purpose');

            if (tariff && purpose instanceof HTMLTextAreaElement) {
                purpose.value = `Интересует тариф «${tariff}» (${price}). Хочу узнать ближайшую дату и условия участия.`;
                if (selectedTariffName) {
                    selectedTariffName.textContent = `${tariff} — ${price}`;
                }
            } else if (selectedTariffName) {
                selectedTariffName.textContent = 'Узнать ближайшую дату';
            }

            trackEvent(tariff ? 'pricing_cta' : 'cta_click', { tariff, price, placement });
            registrationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    purposeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (!form) return;
            const purpose = form.elements.namedItem('purpose');
            if (purpose instanceof HTMLTextAreaElement) {
                purpose.value = button.dataset.purpose || '';
                purpose.focus();
            }
            trackEvent('purpose_selected', { purpose: button.dataset.purpose || '' });
        });
    });

    if (!form) return;

    form.addEventListener('focusin', () => {
        if (!formStarted) {
            formStarted = true;
            trackEvent('form_start');
        }
    });

    form.addEventListener('invalid', (event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            trackEvent('form_validation_error', { field: event.target.name });
        }
    }, true);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 15000);

        if (submitButton instanceof HTMLButtonElement) {
            submitButton.disabled = true;
            submitButton.textContent = 'Отправляем…';
        }

        if (message) {
            message.textContent = '';
            message.className = 'form-message';
        }

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            });

            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json') ? await response.json() : null;

            if (!response.ok || !data?.ok) {
                throw new Error(data?.error || 'Не удалось отправить заявку. Попробуйте ещё раз.');
            }

            trackEvent('submit_success');
            if (message) {
                message.textContent = 'Готово! Заявка принята. Мы свяжемся с вами и предложим ближайшие даты.';
                message.className = 'form-message success';
            }

            form.reset();
            formStarted = false;
            if (selectedTariffName) {
                selectedTariffName.textContent = 'Узнать ближайшую дату';
            }
        } catch (error) {
            const errorText = error instanceof DOMException && error.name === 'AbortError'
                ? 'Сервер отвечает слишком долго. Проверьте соединение и попробуйте ещё раз.'
                : error instanceof Error ? error.message : 'Не удалось отправить заявку.';

            trackEvent('submit_error', { reason: errorText });
            if (message) {
                message.textContent = errorText;
                message.className = 'form-message error';
            }
        } finally {
            window.clearTimeout(timeoutId);
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = false;
                submitButton.textContent = 'Узнать ближайшую дату';
            }
        }
    });
});
