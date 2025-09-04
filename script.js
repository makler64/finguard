    // Основные переменные
    let accounts = JSON.parse(localStorage.getItem('accounts')) || [];
    let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    let goals = JSON.parse(localStorage.getItem('goals')) || [];
    let categories = JSON.parse(localStorage.getItem('categories')) || {
        expense: [
            { id: 'food', name: 'Еда', icon: '🍕' },
            { id: 'transport', name: 'Транспорт', icon: '🚗' },
            { id: 'utilities', name: 'Коммунальные', icon: '🏠' },
            { id: 'entertainment', name: 'Развлечения', icon: '🎬' },
            { id: 'health', name: 'Здоровье', icon: '🏥' },
            { id: 'shopping', name: 'Шопинг', icon: '🛍️' },
            { id: 'children', name: 'Дети', icon: '👶' },
            { id: 'loan', name: 'Заем', icon: '💳' },
            { id: 'credit', name: 'Кредиты', icon: '🏦' },
            { id: 'goals', name: 'Цели', icon: '🎯' },
            { id: 'other', name: 'Другое', icon: '📦' }
        ],
        income: [
            { id: 'salary', name: 'Зарплата', icon: '💰' },
            { id: 'freelance', name: 'Фриланс', icon: '💻' },
            { id: 'investment', name: 'Инвестиции', icon: '📈' },
            { id: 'gift', name: 'Подарок', icon: '🎁' },
            { id: 'other', name: 'Другое', icon: '📦' }
        ]
    };
    
    let currentAccountId = accounts[0]?.id || 1;
    let charts = {};

    // Функция для получения курсов валют за предыдущий день от ЦБ РФ
    async function fetchPreviousDayRates() {
        try {
            const selectedCurrencies = getSelectedCurrencies();
            if (selectedCurrencies.length === 0) {
                return {};
            }
            
            const fiatCurrencies = selectedCurrencies.filter(currency => 
                !['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'LINK'].includes(currency)
            );
            
            let previousRates = {};
            
            if (fiatCurrencies.length > 0) {
                try {
                    // Сначала получаем текущие курсы, чтобы получить ссылку на предыдущий день
                    const currentCbrResponse = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
                    if (!currentCbrResponse.ok) {
                        console.error('Ошибка при получении текущих курсов от ЦБ РФ, статус:', currentCbrResponse.status);
                        return {};
                    }
                    
                    const currentCbrData = await currentCbrResponse.json();
                    
                    // Используем ссылку на предыдущий день из текущего ответа
                    if (currentCbrData.PreviousURL) {
                        const previousUrl = `https://www.cbr-xml-daily.ru${currentCbrData.PreviousURL.replace('//www.cbr-xml-daily.ru', '')}`;
                        
                        const cbrResponse = await fetch(previousUrl);
                        
                        if (!cbrResponse.ok) {
                            console.error('Ошибка при получении курсов за предыдущий день от ЦБ РФ, статус:', cbrResponse.status);
                            return {};
                        }
                        
                        const cbrData = await cbrResponse.json();
                    
                    if (cbrData.Valute) {
                        const cbrCurrencyMapping = {
                            'USD': 'USD',
                            'EUR': 'EUR',
                            'CNY': 'CNY',
                            'GBP': 'GBP',
                            'JPY': 'JPY'
                        };
                        
                        fiatCurrencies.forEach(currency => {
                            const cbrCode = cbrCurrencyMapping[currency];
                            if (cbrCode && cbrData.Valute[cbrCode]) {
                                previousRates[currency] = cbrData.Valute[cbrCode].Value;
                            }
                        });
                        
                        console.log('Курсы валют за предыдущий день получены от ЦБ РФ:', Object.keys(previousRates));
                    } else {
                        console.log('Данные Valute не найдены в ответе ЦБ РФ');
                    }
                    } else {
                        console.log('Ссылка на предыдущий день не найдена в ответе ЦБ РФ');
                    }
                } catch (error) {
                    console.error('Ошибка при получении курсов за предыдущий день от ЦБ РФ:', error);
                }
            }
            
            return previousRates;
        } catch (error) {
            console.error('Ошибка при получении курсов за предыдущий день:', error);
            return {};
        }
    }

    // Функция для получения курсов валют
    async function fetchCurrencyRates() {
        try {
            const selectedCurrencies = getSelectedCurrencies();
            if (selectedCurrencies.length === 0) {
                return;
            }
            
            // Разделяем валюты на фиатные и криптовалюты
            const fiatCurrencies = selectedCurrencies.filter(currency => 
                !['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'LINK'].includes(currency)
            );
            const cryptoCurrencies = selectedCurrencies.filter(currency => 
                ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'LINK'].includes(currency)
            );
            
            let allRates = {};
            
            // Получаем курсы фиатных валют от ЦБ РФ
            if (fiatCurrencies.length > 0) {
                try {
                    // API ЦБ РФ для получения курсов валют
                    const cbrResponse = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
                    
                    if (!cbrResponse.ok) {
                        console.error('Ошибка при получении курсов от ЦБ РФ, статус:', cbrResponse.status);
                        throw new Error(`HTTP ${cbrResponse.status}`);
                    }
                    
                    const cbrData = await cbrResponse.json();
                    
                    if (cbrData.Valute) {
                        // Маппинг валют ЦБ РФ на наши коды
                        const cbrCurrencyMapping = {
                            'USD': 'USD',
                            'EUR': 'EUR',
                            'CNY': 'CNY',
                            'GBP': 'GBP',
                            'JPY': 'JPY'
                        };
                        
                        fiatCurrencies.forEach(currency => {
                            const cbrCode = cbrCurrencyMapping[currency];
                            if (cbrCode && cbrData.Valute[cbrCode]) {
                                // ЦБ РФ предоставляет курс за 1 единицу валюты в рублях
                                allRates[currency] = cbrData.Valute[cbrCode].Value;
                            }
                        });
                        
                        console.log('Курсы валют получены от ЦБ РФ:', Object.keys(allRates));
                    } else {
                        console.log('Данные Valute не найдены в ответе ЦБ РФ');
                    }
                } catch (error) {
                    console.error('Ошибка при получении курсов валют от ЦБ РФ:', error);
                    
                    // Fallback на старый API если ЦБ РФ недоступен
                try {
                    const fiatResponse = await fetch('https://api.exchangerate-api.com/v4/latest/RUB');
                    const fiatData = await fiatResponse.json();
                    if (fiatData.rates) {
                        allRates = { ...fiatData.rates };
                    }
                    } catch (fallbackError) {
                        console.error('Ошибка при получении курсов фиатных валют (fallback):', fallbackError);
                    }
                }
            }
            
            // Получаем курсы криптовалют
            if (cryptoCurrencies.length > 0) {
                try {
                    const cryptoResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,cardano,solana,polkadot,matic,chainlink&vs_currencies=rub');
                    const cryptoData = await cryptoResponse.json();
                    
                    // Преобразуем данные CoinGecko в формат, совместимый с нашей системой
                    const cryptoMapping = {
                        'BTC': 'bitcoin',
                        'ETH': 'ethereum',
                        'BNB': 'binancecoin',
                        'ADA': 'cardano',
                        'SOL': 'solana',
                        'DOT': 'polkadot',
                        'MATIC': 'matic',
                        'LINK': 'chainlink'
                    };
                    
                    cryptoCurrencies.forEach(crypto => {
                        const coinId = cryptoMapping[crypto];
                        if (cryptoData[coinId] && cryptoData[coinId].rub) {
                            // Для криптовалют сохраняем курс в рублях (не инвертируем)
                            allRates[crypto] = cryptoData[coinId].rub;
                        }
                    });
                } catch (error) {
                    console.error('Ошибка при получении курсов криптовалют:', error);
                }
            }
            
            if (Object.keys(allRates).length > 0) {
                // Убеждаемся, что настройки валют загружены
                loadCurrencySettings();
                
                // Получаем курсы за предыдущий день от ЦБ РФ
                const previousDayRates = await fetchPreviousDayRates();
                
                // Объединяем текущие курсы с курсами за предыдущий день
                const ratesWithComparison = { ...allRates };
                
                // Добавляем курсы за предыдущий день для сравнения
                Object.keys(previousDayRates).forEach(currency => {
                    if (ratesWithComparison[currency]) {
                        ratesWithComparison[`${currency}_previous`] = previousDayRates[currency];
                    }
                });
                
                // Обновляем курсы валют с сравнением
                updateCurrencyRates(ratesWithComparison, true, previousDayRates);
                
                // Сохраняем новые курсы в localStorage
                const now = new Date();
                const dataToSave = {
                    rates: allRates,
                    previousDayRates: previousDayRates,
                    timestamp: now.getTime()
                };
                localStorage.setItem('currencyRates', JSON.stringify(dataToSave));
                
                console.log('Курсы валют успешно обновлены с сравнением:', Object.keys(allRates));
            }
        } catch (error) {
            console.error('Ошибка при получении курсов валют:', error);
        }
    }

    // Функция для обновления отображения курсов валют
    function updateCurrencyRates(rates, showChangeIndicators = true, previousDayRates = {}) {
        const selectedCurrencies = getSelectedCurrencies();
        const currencyContainer = document.getElementById('currencyRatesInline');
        
        if (!currencyContainer) {
            console.log('Контейнер курсов валют не найден');
            return;
        }
        
        console.log('Обновление курсов валют. Выбранные валюты:', selectedCurrencies);
        console.log('Доступные курсы:', Object.keys(rates || {}));
        
        // Проверяем, есть ли выбранные валюты
        if (selectedCurrencies.length === 0) {
            console.log('Нет выбранных валют, скрываем контейнер');
            currencyContainer.style.display = 'none';
            return;
        }
        
        // Показываем контейнер, если он был скрыт
        currencyContainer.style.display = 'flex';
        

        
        // Очищаем контейнер
        currencyContainer.innerHTML = '';
        
        // Получаем предыдущие курсы из localStorage если не переданы
        if (Object.keys(previousDayRates).length === 0) {
            const savedRates = localStorage.getItem('currencyRates');
            if (savedRates) {
                try {
                    const data = JSON.parse(savedRates);
                    previousDayRates = data.previousDayRates || {};
                } catch (error) {
                    console.error('Ошибка при чтении предыдущих курсов:', error);
                }
            }
        }
        
        selectedCurrencies.forEach(currency => {
            if (rates && rates[currency]) {
                // Определяем, является ли валюта криптовалютой
                const isCrypto = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'LINK'].includes(currency);
                
                // Рассчитываем курс в рублях за 1 единицу валюты
                let rate;
                if (isCrypto) {
                    // Для криптовалют курс уже в рублях
                    rate = rates[currency].toFixed(2);
                } else {
                    // Для фиатных валют от ЦБ РФ курс уже в рублях за 1 единицу валюты
                    rate = rates[currency].toFixed(2);
                }
                
                // Получаем предыдущий курс для сравнения (за предыдущий день)
                const previousRate = previousDayRates[currency];
                
                // Определяем изменение курса
                let changeIndicator = '';
                let changeClass = '';
                let rateValueClass = '';
                
                console.log(`Валюта: ${currency}, Текущий курс: ${rates[currency]}, Предыдущий день: ${previousRate}, Крипто: ${isCrypto}`);
                
                if (showChangeIndicators && previousRate && previousRate !== 0) {
                    let currentRateValue, previousRateValue;
                    
                    if (isCrypto) {
                        // Для криптовалют сравниваем прямые курсы в рублях
                        currentRateValue = rates[currency];
                        previousRateValue = previousRate;
                    } else {
                        // Для фиатных валют от ЦБ РФ сравниваем прямые курсы в рублях
                        currentRateValue = rates[currency];
                        previousRateValue = previousRate;
                    }
                    
                    const change = currentRateValue - previousRateValue;
                    const changePercent = ((change / previousRateValue) * 100).toFixed(2);
                    
                    if (change > 0) {
                        // Курс вырос (зеленый)
                        changeIndicator = `+${changePercent}%`;
                        changeClass = 'rate-up';
                        rateValueClass = 'rate-value-up';
                    } else if (change < 0) {
                        // Курс упал (красный)
                        changeIndicator = `${changePercent}%`;
                        changeClass = 'rate-down';
                        rateValueClass = 'rate-value-down';
                    }
                }
                
                // Создаем элемент валюты
                const currencyElement = document.createElement('div');
                currencyElement.className = 'currency-item-inline';
                currencyElement.innerHTML = `
                    <div class="currency-info-inline">
                        <span class="currency-name-inline">${currency}</span>
                        <span class="currency-full-name-inline">${getCurrencyFullName(currency)}</span>
                    </div>
                    <div class="currency-rate-inline">
                        <span class="rate-value-inline ${rateValueClass}">${rate} ₽</span>
                        ${changeIndicator ? `<div class="change-indicator ${changeClass}">${changeIndicator}</div>` : ''}
                    </div>
                `;
                
                currencyContainer.appendChild(currencyElement);
            }
        });
        
        // Проверяем, были ли добавлены валюты
        const addedCurrencies = currencyContainer.children.length;
        console.log(`Добавлено валют в контейнер: ${addedCurrencies}`);
        
        if (addedCurrencies === 0) {
            console.log('Не было добавлено ни одной валюты, скрываем контейнер');
            currencyContainer.style.display = 'none';
        } else {
            console.log('Контейнер курсов валют отображается');
        }
        
        // Обновляем время последнего обновления
        updateLastUpdateTime();
    }



    // Функция для обновления времени последнего обновления курсов валют
    function updateLastUpdateTime() {
        const lastUpdateElement = document.getElementById('lastUpdateTime');
        if (!lastUpdateElement) return;
        
        const saved = localStorage.getItem('currencyRates');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.timestamp) {
                    const updateDate = new Date(data.timestamp);
                    const now = new Date();
                    const diffMs = now - updateDate;
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);
                    
                    let timeText;
                    if (diffMins < 1) {
                        timeText = 'Только что';
                    } else if (diffMins < 60) {
                        timeText = `${diffMins} мин. назад`;
                    } else if (diffHours < 24) {
                        timeText = `${diffHours} ч. назад`;
                    } else {
                        timeText = `${diffDays} дн. назад`;
                    }
                    
                    lastUpdateElement.textContent = timeText;
                    console.log('Время последнего обновления обновлено:', timeText);
                } else {
                    lastUpdateElement.textContent = 'Неизвестно';
                }
            } catch (error) {
                console.error('Ошибка при обновлении времени последнего обновления:', error);
                lastUpdateElement.textContent = 'Ошибка';
            }
        } else {
            lastUpdateElement.textContent = 'Не обновлялось';
        }
    }

    // Функция для получения полного названия валюты
    function getCurrencyFullName(currency) {
        const names = {
            'USD': 'Доллар США',
            'EUR': 'Евро',
            'CNY': 'Юань',
            'GBP': 'Фунт стерлингов',
            'JPY': 'Иена',
            // Криптовалюты
            'BTC': 'Bitcoin',
            'ETH': 'Ethereum',
            'BNB': 'Binance Coin',
            'ADA': 'Cardano',
            'SOL': 'Solana',
            'DOT': 'Polkadot',
            'MATIC': 'Polygon',
            'LINK': 'Chainlink'
        };
        return names[currency] || currency;
    }



    // Функция для получения выбранных валют
    function getSelectedCurrencies() {
        // Сначала пытаемся получить из чекбоксов на странице
        const checkboxes = document.querySelectorAll('.currency-checkboxes input[type="checkbox"]:checked');
        if (checkboxes.length > 0) {
            const selected = Array.from(checkboxes).map(cb => cb.value);
            console.log('Выбранные валюты из чекбоксов:', selected);
            return selected;
        }
        
        // Если чекбоксы не найдены или не выбраны, загружаем из localStorage
        const savedSettings = localStorage.getItem('currencySettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                const selected = Object.keys(settings).filter(currency => settings[currency]);
                console.log('Выбранные валюты из localStorage:', selected);
                return selected;
            } catch (error) {
                console.error('Ошибка при чтении настроек валют:', error);
            }
        }
        
        // Если нет сохраненных настроек, возвращаем пустой массив
        console.log('Нет выбранных валют');
        return [];
    }

    // Функция для загрузки настроек валют
    function loadCurrencySettings() {
        console.log('Загрузка настроек валют...');
        
        // Загружаем состояние аккордеона курсов валют
        const savedAccordionState = localStorage.getItem('currencyAccordionState');
        const accordionContent = document.getElementById('currencyAccordionContent');
        
        if (accordionContent && savedAccordionState === 'expanded') {
            accordionContent.classList.add('expanded');
            accordionContent.classList.remove('collapsed');
            const toggle = document.querySelector('[data-accordion="currency"] .accordion-toggle');
            if (toggle) {
                toggle.classList.add('expanded');
            }
        } else if (accordionContent) {
            accordionContent.classList.add('collapsed');
            accordionContent.classList.remove('expanded');
        }
        
        const savedSettings = localStorage.getItem('currencySettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                console.log('Загруженные настройки валют:', settings);
                
                Object.keys(settings).forEach(currency => {
                    const checkbox = document.querySelector(`.currency-checkboxes input[value="${currency}"]`);
                    if (checkbox) {
                        checkbox.checked = settings[currency];
                        console.log(`Установлен чекбокс для ${currency}: ${settings[currency]}`);
                    } else {
                        console.log(`Чекбокс для ${currency} не найден на странице`);
                    }
                });
                
                // Проверяем, есть ли выбранные валюты
                const selectedCurrencies = Object.keys(settings).filter(currency => settings[currency]);
                console.log('Выбранные валюты после загрузки:', selectedCurrencies);
                
                if (selectedCurrencies.length === 0) {
                    // Если все валюты отключены, скрываем блок курсов
                    const currencyContainer = document.getElementById('currencyRatesInline');
                    if (currencyContainer) {
                        currencyContainer.style.display = 'none';
                        console.log('Блок курсов валют скрыт (нет выбранных валют)');
                    }
                }
            } catch (error) {
                console.error('Ошибка при загрузке настроек валют:', error);
                // Если ошибка, устанавливаем настройки по умолчанию
                setDefaultCurrencySettings();
            }
        } else {
            console.log('Нет сохраненных настроек валют, устанавливаем по умолчанию');
            // Если нет сохраненных настроек, устанавливаем по умолчанию
            setDefaultCurrencySettings();
        }
        
        // Обновляем время последнего обновления
        updateLastUpdateTime();
    }

    // Функция для установки настроек валют по умолчанию
    function setDefaultCurrencySettings() {
        console.log('Установка настроек валют по умолчанию...');
        
        // Проверяем, были ли уже сохранены настройки
        const existingSettings = localStorage.getItem('currencySettings');
        if (existingSettings) {
            console.log('Настройки валют уже существуют, не перезаписываем');
            return;
        }
        
        const defaultCurrencies = ['USD', 'EUR', 'CNY'];
        console.log('Устанавливаем валюты по умолчанию:', defaultCurrencies);
        
        defaultCurrencies.forEach(currency => {
            const checkbox = document.querySelector(`.currency-checkboxes input[value="${currency}"]`);
            if (checkbox) {
                checkbox.checked = true;
                console.log(`Установлен чекбокс по умолчанию для ${currency}`);
            } else {
                console.log(`Чекбокс для ${currency} не найден при установке по умолчанию`);
            }
        });
        
        // Сохраняем настройки по умолчанию только при первом запуске
        const settings = {};
        defaultCurrencies.forEach(currency => {
            settings[currency] = true;
        });
        localStorage.setItem('currencySettings', JSON.stringify(settings));
        console.log('Настройки валют по умолчанию сохранены:', settings);
    }

    // Функция для проверки активности курсов валют
    function isCurrencyRatesActive() {
        // Проверяем, есть ли выбранные валюты
        const selectedCurrencies = getSelectedCurrencies();
        return selectedCurrencies.length > 0;
    }

    // Функция для автоматического обновления курсов
    function startAutoUpdate() {
        // Обновляем курсы каждые 5 минут для криптовалют и каждые 15 минут для фиатных валют
        setInterval(async () => {
            if (isCurrencyRatesActive()) {
                try {
                    await fetchCurrencyRates();
                    console.log('Курсы валют автоматически обновлены');
                    // Обновляем время последнего обновления
                    updateLastUpdateTime();
                } catch (error) {
                    console.error('Ошибка при автоматическом обновлении курсов:', error);
                }
            }
        }, 5 * 60 * 1000); // 5 минут
        
        // Дополнительное обновление каждые 15 минут для фиатных валют
        setInterval(async () => {
            if (isCurrencyRatesActive()) {
                try {
                    await fetchCurrencyRates();
                    console.log('Курсы фиатных валют обновлены');
                    // Обновляем время последнего обновления
                    updateLastUpdateTime();
                } catch (error) {
                    console.error('Ошибка при обновлении фиатных валют:', error);
                }
            }
        }, 15 * 60 * 1000); // 15 минут
    }

    // Функция для сохранения настроек валют
    function saveCurrencySettings() {
        const checkboxes = document.querySelectorAll('.currency-checkboxes input[type="checkbox"]');
        const settings = {};
        
        console.log('Сохранение настроек валют. Найдено чекбоксов:', checkboxes.length);
        
        checkboxes.forEach(cb => {
            settings[cb.value] = cb.checked;
            console.log(`Валюта ${cb.value}: ${cb.checked ? 'включена' : 'выключена'}`);
        });
        
        localStorage.setItem('currencySettings', JSON.stringify(settings));
        console.log('Настройки валют сохранены в localStorage:', settings);
        
        // Проверяем, есть ли выбранные валюты
        const selectedCurrencies = Object.keys(settings).filter(currency => settings[currency]);
        
        if (selectedCurrencies.length === 0) {
            // Если нет выбранных валют, скрываем весь блок курсов валют
            const currencyContainer = document.getElementById('currencyRatesInline');
            if (currencyContainer) {
                currencyContainer.style.display = 'none';
            }
            console.log('Настройки валют сохранены! Все валюты отключены.');
            return;
        }
        
        // Обновляем отображение курсов
        const savedRates = localStorage.getItem('currencyRates');
        if (savedRates) {
            try {
                const data = JSON.parse(savedRates);
                const now = new Date().getTime();
                const fiveMinutes = 5 * 60 * 1000; // 5 минут в миллисекундах
                const fifteenMinutes = 15 * 60 * 1000; // 15 минут в миллисекундах
                
                // Проверяем, есть ли криптовалюты среди выбранных
                const hasCrypto = selectedCurrencies.some(currency => 
                    ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'LINK'].includes(currency)
                );
                
                // Для криптовалют используем более короткий интервал (5 минут)
                // Для фиатных валют - 15 минут
                const maxAge = hasCrypto ? fiveMinutes : fifteenMinutes;
                
                if (now - data.timestamp < maxAge) {
                    updateCurrencyRates(data.rates, true, data.previousDayRates || {});
                } else {
                    // Если курсы устарели, загружаем новые
                    fetchCurrencyRates();
                }
            } catch (error) {
                console.error('Ошибка при обновлении курсов:', error);
                // Если ошибка, загружаем новые курсы
                fetchCurrencyRates();
            }
        } else {
            // Если нет сохраненных курсов, загружаем новые
            fetchCurrencyRates();
        }
        
        // Настройки сохранены тихо
        console.log('Настройки валют сохранены!');
        
        // Если курсы валют активны, обновляем их
        if (isCurrencyRatesActive()) {
            setTimeout(() => {
                fetchCurrencyRates();
            }, 1000); // Обновляем через 1 секунду после сохранения
        }
        
        // Обновляем время последнего обновления
        updateLastUpdateTime();
    }

    // Функция для загрузки сохраненных курсов валют
    function loadSavedCurrencyRates() {
        // Убеждаемся, что настройки валют загружены
        loadCurrencySettings();
        
        const saved = localStorage.getItem('currencyRates');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                const now = new Date().getTime();
                const fiveMinutes = 5 * 60 * 1000; // 5 минут в миллисекундах
                const fifteenMinutes = 15 * 60 * 1000; // 15 минут в миллисекундах
                
                // Проверяем, есть ли криптовалюты среди выбранных
                const selectedCurrencies = getSelectedCurrencies();
                const hasCrypto = selectedCurrencies.some(currency => 
                    ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'LINK'].includes(currency)
                );
                
                // Для криптовалют используем более короткий интервал (5 минут)
                // Для фиатных валют - 15 минут
                const maxAge = hasCrypto ? fiveMinutes : fifteenMinutes;
                
                if (now - data.timestamp < maxAge) {
                    // При загрузке сохраненных курсов показываем индикаторы изменения
                    // используя сохраненные курсы за предыдущий день
                    updateCurrencyRates(data.rates, true, data.previousDayRates || {});
                    return;
                }
            } catch (error) {
                console.error('Ошибка при загрузке сохраненных курсов:', error);
            }
        }
        
        // Если нет сохраненных курсов или они устарели, загружаем новые
        fetchCurrencyRates();
    }

    // Функция обновления индикатора активного таба
    function updateTabIndicator(activeTab) {
        const tabsNav = document.querySelector('.tabs-nav');
        let indicator = tabsNav.querySelector('.tab-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'tab-indicator';
            tabsNav.appendChild(indicator);
        }
        
        const tabRect = activeTab.getBoundingClientRect();
        const navRect = tabsNav.getBoundingClientRect();
        
        indicator.style.left = (tabRect.left - navRect.left) + 'px';
        indicator.style.width = tabRect.width + 'px';
    }

    // Инициализация приложения после загрузки DOM
    function initApp() {
        // Подавление ошибок браузерных расширений
        window.addEventListener('error', (e) => {
            if (e.message && (
                e.message.includes('message port closed') || 
                e.message.includes('message channel closed') ||
                e.message.includes('listener indicated an asynchronous response') ||
                e.message.includes('Extension context invalidated') ||
                e.message.includes('Could not establish connection')
            )) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });
        
        // Подавление ошибок в Promise
        window.addEventListener('unhandledrejection', (e) => {
            if (e.reason && e.reason.message && (
                e.reason.message.includes('message port closed') || 
                e.reason.message.includes('message channel closed') ||
                e.reason.message.includes('listener indicated an asynchronous response') ||
                e.reason.message.includes('Extension context invalidated') ||
                e.reason.message.includes('Could not establish connection')
            )) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });
        // Проверяем, первый ли это запуск
        const isFirstRun = !localStorage.getItem('appInitialized');
        if (isFirstRun) {
            // Очищаем все данные при первом запуске
            localStorage.clear();
            
            // Инициализируем пустые массивы
            accounts = [];
            transactions = [];
            goals = [];
            
            // Устанавливаем настройки по умолчанию для первого запуска
            localStorage.setItem('darkMode', 'true'); // Темная тема по умолчанию
            localStorage.setItem('accountsAccordionState', 'expanded'); // Открытая плашка счетов
            localStorage.setItem('mainAccountsAccordionState', 'expanded'); // Открытая плашка "Мои счета"
            localStorage.setItem('currencyAccordionState', 'collapsed'); // Закрытая плашка валют
            localStorage.setItem('categoriesAccordionState', 'collapsed'); // Закрытая плашка категорий
            localStorage.setItem('filtersAccordionState', 'collapsed'); // Закрытая плашка фильтров
            localStorage.setItem('appInitialized', 'true');
            
            // Сохраняем пустые данные
            updateLocalStorage();
        }
        
        // Загружаем данные из localStorage
        const savedAccounts = localStorage.getItem('accounts');
        const savedTransactions = localStorage.getItem('transactions');
        const savedGoals = localStorage.getItem('goals');
        const savedCategories = localStorage.getItem('categories');
        
        if (savedAccounts) {
            accounts = JSON.parse(savedAccounts);
        }
        
        if (savedTransactions) {
            transactions = JSON.parse(savedTransactions);
        }
        
        if (savedGoals) {
            goals = JSON.parse(savedGoals);
        }
        
        if (savedCategories) {
            categories = JSON.parse(savedCategories);
        }
        
        updateLocalStorage();
        
        // Добавляем задержку для полной загрузки DOM
        setTimeout(() => {
            renderAccounts();
            renderTransactions();
            renderGoals();
            showPlaceholdersIfNeeded(); // Показываем заглушки при необходимости
            updateDashboard();
            
            // Переинициализируем обработчики событий после рендеринга
            setupEventListeners();
        }, 100);
        initCharts();
        setupEventListeners();
        initFilters();
        
        // Загружаем настройки валют
        loadCurrencySettings();
        

        
        
        // Загружаем состояние аккордеона для управления категориями
        const savedCategoriesAccordionState = localStorage.getItem('categoriesAccordionState');
        const categoriesAccordionContent = document.getElementById('categoriesAccordionContent');
        if (categoriesAccordionContent && savedCategoriesAccordionState === 'expanded') {
            categoriesAccordionContent.classList.add('expanded');
            categoriesAccordionContent.classList.remove('collapsed');
            const toggle = document.querySelector('[data-accordion="categories"] .accordion-toggle');
            if (toggle) {
                toggle.classList.add('expanded');
            }
        } else if (categoriesAccordionContent) {
            categoriesAccordionContent.classList.add('collapsed');
            categoriesAccordionContent.classList.remove('expanded');
        }
        
        // Загружаем курсы валют
        loadSavedCurrencyRates();
        
        // Запускаем автоматическое обновление курсов
        startAutoUpdate();
        
        // Обновляем время последнего обновления при инициализации
        setTimeout(() => {
            updateLastUpdateTime();
        }, 500);
        

        

        
        // Загружаем категории в настройки
        loadCategoriesSettings();
        
        // Инициализируем новую систему аккордеонов
        setTimeout(() => {
            initAccordions();
        }, 500);
        
        // Инициализируем заглушки при загрузке страницы
        setTimeout(() => {
            showPlaceholdersIfNeeded();
        }, 100);
        
        // Установка начальной активной вкладки
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById('transactions-tab').classList.add('active');
        
        // Инициализация индикатора активного таба
        const activeTab = document.querySelector('.tab-item.active');
        if (activeTab) {
            updateTabIndicator(activeTab);
        }
        
        // Добавляем анимацию для первого активного таба
        const firstActiveTab = document.getElementById('transactions-tab');
        if (firstActiveTab) {
            setTimeout(() => {
                firstActiveTab.classList.add('fade-in');
            }, 100);
        }
        
        // Обновляем месячную статистику при инициализации
        updateMonthlyStats();
        

    }



    // Обновление localStorage
    function updateLocalStorage() {
        localStorage.setItem('accounts', JSON.stringify(accounts));
        localStorage.setItem('transactions', JSON.stringify(transactions));
        localStorage.setItem('goals', JSON.stringify(goals));
        localStorage.setItem('categories', JSON.stringify(categories));
    }

    // Загрузка данных из localStorage


    // Генерация ID
    function generateId(items) {
        return items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
    }

    // Генерация ID для категорий
    function generateCategoryId(type) {
        const allCategories = [...categories.expense, ...categories.income];
        let maxId = 0;
        
        allCategories.forEach(category => {
            if (typeof category.id === 'string') {
                // Для строковых ID просто генерируем уникальное имя
                return;
            } else if (typeof category.id === 'number') {
                maxId = Math.max(maxId, category.id);
            }
        });
        
        // Если все ID строковые, создаем уникальное строковое имя
        const baseName = type === 'expense' ? 'expense_' : 'income_';
        const timestamp = Date.now();
        return baseName + timestamp;
    }

    // Функция для загрузки категорий в настройки
    function loadCategoriesSettings() {
        const expenseCategoriesList = document.getElementById('expenseCategoriesList');
        const incomeCategoriesList = document.getElementById('incomeCategoriesList');
        
        console.log('loadCategoriesSettings called');
        console.log('expenseCategoriesList:', expenseCategoriesList);
        console.log('incomeCategoriesList:', incomeCategoriesList);
        console.log('categories:', categories);
        
        if (!expenseCategoriesList || !incomeCategoriesList) {
            console.log('Categories lists not found, returning');
            return;
        }
        
        // Очистка
        expenseCategoriesList.innerHTML = '';
        incomeCategoriesList.innerHTML = '';
        
        // Заполняем категории расходов
        categories.expense.forEach(category => {
            const categoryItem = createCategorySettingsItem(category, 'expense');
            expenseCategoriesList.appendChild(categoryItem);
        });
        
        // Заполняем категории доходов
        categories.income.forEach(category => {
            const categoryItem = createCategorySettingsItem(category, 'income');
            incomeCategoriesList.appendChild(categoryItem);
        });
        
        console.log('Categories loaded successfully');
    }

    // Создание элемента категории для настроек
    function createCategorySettingsItem(category, type) {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-settings-item';
        
        categoryItem.innerHTML = `
            <div class="category-settings-info">
                <span class="category-settings-icon">${category.icon}</span>
                <div class="category-settings-details">
                    <div class="category-settings-name">${category.name}</div>
                    <div class="category-settings-type">${type === 'expense' ? 'Расход' : 'Доход'}</div>
                </div>
            </div>
            <div class="category-settings-actions">
                <button class="category-settings-btn edit edit-category" data-id="${category.id}" data-type="${type}" title="Редактировать">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
                    </svg>
                </button>
                <button class="category-settings-btn delete delete-category" data-id="${category.id}" data-type="${type}" title="Удалить">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.41 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Добавляем обработчики событий для редактирования и удаления
        const editBtn = categoryItem.querySelector('.edit-category');
        const deleteBtn = categoryItem.querySelector('.delete-category');
        
        editBtn.addEventListener('click', () => editCategory(category.id, type));
        deleteBtn.addEventListener('click', () => deleteCategory(category.id, type));
        
        return categoryItem;
    }

    // Рендер счетов
    function renderAccounts() {
        const accountSelector = document.getElementById('accountSelector');
        const accountsList = document.getElementById('accountsList');
        const transactionAccountSelect = document.getElementById('transactionAccount');
        

        
        if (!accountSelector || !accountsList) return;
        
        // Очистка
        accountSelector.innerHTML = '';
        accountsList.innerHTML = '';
        if (transactionAccountSelect) {
            transactionAccountSelect.innerHTML = '';
        }
        
        // Добавление счетов в селектор
        accounts.forEach(account => {
            const accountItem = document.createElement('div');
            accountItem.className = 'account-item';
            accountItem.dataset.id = account.id;
            
            // Определяем иконку - приоритет у логотипа банка
            let icon = '';
            if (account.bank && account.bank !== '') {
                icon = `<div class="bank-logo ${account.bank}"></div>`;
            } else {
                // Стандартные иконки по типу счета
                icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm-1 14H5c-.55 0-1-.45-1-1V8h16v9c0 .55-.45 1-1 1z"/></svg>';
                if (account.type === 'cash') icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V8h16v10zm-8-2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>';
                if (account.type === 'credit') icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm-1 14H5c-.55 0-1-.45-1-1V8h16v9c0 .55-.45 1-1 1z"/></svg>';
                if (account.type === 'savings') icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
                if (account.type === 'investment') icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>';
            }
            
            // Определяем название банка и тип счета
            const bankName = account.bankName || '';
            const accountTypeName = account.type === 'cash' ? 'Наличные' : 
                account.type === 'card' ? 'Банковская карта' : 
                account.type === 'credit' ? 'Кредитная карта' : 
                account.type === 'savings' ? 'Сберегательный счет' : 'Инвестиционный счет';
            
            accountItem.innerHTML = `
                ${icon}
                <div>
                    <div style="font-size: 13px; color: var(--text-primary); font-weight: 500;">${bankName}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${accountTypeName}</div>
                    <div style="font-size: 14px; color: var(--text-primary); margin-top: 4px; font-weight: 600;">${account.balance.toFixed(2)} ${account.currency}</div>
                </div>
            `;
            
            accountSelector.appendChild(accountItem);
            
            // Добавление в выпадающий список
            if (transactionAccountSelect) {
                const option = document.createElement('option');
                option.value = account.id;
                option.textContent = `${account.name} (${account.balance.toFixed(2)} ${account.currency})`;
                transactionAccountSelect.appendChild(option);
            }
        });

        // Добавление кнопки "+" для создания нового счета или заглушки
        if (accounts.length === 0) {
            // Показываем заглушку когда счетов нет
            const placeholder = document.createElement('div');
            placeholder.className = 'accounts-placeholder';
            placeholder.innerHTML = `
                <div class="placeholder-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                        <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm-1 14H5c-.55 0-1-.45-1-1V8h16v9c0 .55-.45 1-1 1z"/>
                    </svg>
                </div>
                <h3>У вас пока нет счетов</h3>
                <p>Создайте свой первый счет для начала управления финансами</p>
                <button class="btn btn-primary create-account-btn" onclick="openAccountModal()">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    Создать счет
                </button>
            `;
            accountSelector.appendChild(placeholder);
        } else {
            // Показываем кнопку "+" когда есть счета
            const addAccountButton = document.createElement('button');
            addAccountButton.className = 'add-account-btn';
            addAccountButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
            `;
            addAccountButton.addEventListener('click', openAccountModal);
            accountSelector.appendChild(addAccountButton);
        }
        
        // Запускаем анимацию для элементов счетов
        setTimeout(() => {
            const accountItems = accountSelector.querySelectorAll('.account-item, .add-account-btn, .accounts-placeholder');
            accountItems.forEach((item) => {
                item.classList.add('animate');
            });
        }, 300);
        
        // Добавление счетов в настройки (компактный список)
        const accountsSettingsList = document.createElement('div');
        accountsSettingsList.className = 'accounts-settings-list';
        
        if (accounts.length === 0) {
            accountsSettingsList.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
                    <p>У вас пока нет счетов</p>
                </div>
            `;
        } else {
            accounts.forEach(account => {
                const accountItem = document.createElement('div');
                accountItem.className = 'account-settings-item';
                
                let icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm-1 14H5c-.55 0-1-.45-1-1V8h16v9c0 .55-.45 1-1 1z"/></svg>';
                if (account.type === 'cash') icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V8h16v10zm-8-2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-6c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>';
                if (account.type === 'credit') icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm-1 14H5c-.55 0-1-.45-1-1V8h16v9c0 .55-.45 1-1 1z"/></svg>';
                if (account.type === 'savings') icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
                if (account.type === 'investment') icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>';
                
                const accountTypeName = account.type === 'cash' ? 'Наличные' : 
                    account.type === 'card' ? 'Банковская карта' : 
                    account.type === 'credit' ? 'Кредитная карта' : 
                    account.type === 'savings' ? 'Сберегательный счет' : 'Инвестиционный счет';
                
                accountItem.innerHTML = `
                    <div class="account-settings-info">
                        <span class="account-settings-icon">${icon}</span>
                        <div class="account-settings-details">
                            <div class="account-settings-name">${account.name}</div>
                            <div class="account-settings-type">${accountTypeName}</div>
                        </div>
                    </div>
                    <div class="account-settings-balance">${account.balance.toFixed(2)} ${account.currency}</div>
                    <div class="account-settings-actions">
                        <button class="account-settings-btn edit edit-account" data-id="${account.id}" title="Редактировать">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
                            </svg>
                            <span>Редактировать</span>
                        </button>
                    </div>
                `;
                
                accountsSettingsList.appendChild(accountItem);
            });
        }
        
        accountsList.appendChild(accountsSettingsList);
        
        // Показываем/скрываем кнопку перевода в зависимости от количества счетов
        updateTransferButtonVisibility();
        
        // Обновление баланса
        updateBalance();
    }

    // Функция для обновления видимости кнопки перевода
    function updateTransferButtonVisibility() {
        const transferButtonContainer = document.getElementById('transferButtonContainer');
        if (transferButtonContainer) {
            // Показываем кнопку только если счетов больше одного
            if (accounts.length > 1) {
                transferButtonContainer.style.display = 'block';
            } else {
                transferButtonContainer.style.display = 'none';
            }
        }
    }

    // Обновление баланса
    function updateBalance() {
        const totalBalanceEl = document.getElementById('totalBalance');
        const accountsBalanceListEl = document.getElementById('accountsBalanceList');
        

        
        if (!totalBalanceEl || !accountsBalanceListEl) {
            return;
        }
        
        // Общий баланс всех счетов
        const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
        totalBalanceEl.textContent = `${totalBalance.toFixed(2)} ₽`;
        
        // Очищаем список плашек счетов
        accountsBalanceListEl.innerHTML = '';
        
        // Создаем плашку для каждого счета

        accounts.forEach(account => {
            const accountBalanceItem = document.createElement('div');
            accountBalanceItem.className = 'account-balance-item';
            
            // Определяем иконку - приоритет у логотипа банка
            let icon = '';
            if (account.bank && account.bank !== '') {
                icon = `<div class="bank-logo ${account.bank}"></div>`;
            } else {
                // Иконка для счета (первая буква названия)
                const firstLetter = account.name.charAt(0).toUpperCase();
                icon = `<div class="account-balance-icon">${firstLetter}</div>`;
            }
            
            // Определяем название банка и тип счета
            const bankName = account.bankName || '';
            const accountTypeName = account.type === 'cash' ? 'Наличные' : 
                account.type === 'card' ? 'Банковская карта' : 
                account.type === 'credit' ? 'Кредитная карта' : 
                account.type === 'savings' ? 'Сберегательный счет' : 'Инвестиционный счет';
            
            accountBalanceItem.innerHTML = `
                <div class="account-balance-info">
                    ${icon}
                    <div class="account-balance-details">
                        <div style="font-size: 13px; color: #ffffff; font-weight: 500;">${bankName}</div>
                        <div style="font-size: 12px; color: rgba(255, 255, 255, 0.8); margin-top: 2px;">${accountTypeName}</div>
                    </div>
                </div>
                <div class="account-balance-amount">${account.balance.toFixed(2)} ₽</div>
            `;
            
            accountsBalanceListEl.appendChild(accountBalanceItem);
        });
        

    }

    // Рендер транзакций
    // Автоматически фильтрует транзакции с несуществующими счетами
    // Сортирует по дате (новые первыми) и по ID (последние созданные сверху)
    function renderTransactions() {
        const allTransactionsList = document.getElementById('allTransactions');
        
        if (!allTransactionsList) return;
        
        // Очистка
        allTransactionsList.innerHTML = '';
        
        // Фильтруем транзакции, исключая те, что ссылаются на несуществующие счета
        const validTransactions = transactions.filter(transaction => {
            const accountExists = accounts.find(a => a.id === transaction.accountId);
            return accountExists; // Возвращаем только транзакции с существующими счетами
        });
        
        // Сортировка по дате и ID (новые сначала, последние созданные сверху)
        const sortedTransactions = [...validTransactions].sort((a, b) => {
            // Сначала сортируем по дате (новые даты первыми)
            const dateComparison = new Date(b.date) - new Date(a.date);
            if (dateComparison !== 0) return dateComparison;
            
            // Если даты одинаковые, сортируем по ID (последние созданные первыми)
            // Это обеспечивает, что транзакции, созданные позже в тот же день, будут сверху
            return b.id - a.id;
        });
        
        // Все транзакции
        sortedTransactions.forEach(transaction => {
            const transactionElement = createTransactionElement(transaction);
            allTransactionsList.appendChild(transactionElement);
        });
        
        // Обновление статистики
        updateStats();
        
        // Переинициализируем обработчики событий после рендеринга транзакций
        setupEventListeners();
    }

    // Функция фильтрации транзакций
    // Автоматически исключает транзакции с несуществующими счетами
    // Сортирует по дате (новые первыми) и по ID (последние созданные сверху)
    function filterTransactions() {
        const filterType = document.getElementById('filterType')?.value || '';
        const filterAccount = document.getElementById('filterAccount')?.value || '';
        const filterCategory = document.getElementById('filterCategory')?.value || '';
        const filterDateFrom = document.getElementById('filterDateFrom')?.value || '';
        const filterDateTo = document.getElementById('filterDateTo')?.value || '';


        let filteredTransactions = transactions.filter(transaction => {
            // Фильтр по типу
            if (filterType && transaction.type !== filterType) return false;
            
            // Фильтр по счету (проверяем существование счета)
            if (filterAccount) {
                if (transaction.accountId !== parseInt(filterAccount)) return false;
            } else {
                // Если счет не выбран, проверяем что транзакция ссылается на существующий счет
                const accountExists = accounts.find(a => a.id === transaction.accountId);
                if (!accountExists) return false; // Пропускаем транзакции с несуществующими счетами
            }
            
            // Фильтр по категории
            if (filterCategory && transaction.category !== filterCategory) return false;
            
            // Фильтр по дате (от)
            if (filterDateFrom && new Date(transaction.date) < new Date(filterDateFrom)) return false;
            
            // Фильтр по дате (до)
            if (filterDateTo && new Date(transaction.date) > new Date(filterDateTo)) return false;
            

            
            return true;
        });

        // Сортировка по дате и ID (новые сначала, последние созданные сверху)
        filteredTransactions.sort((a, b) => {
            // Сначала сортируем по дате (новые даты первыми)
            const dateComparison = new Date(b.date) - new Date(a.date);
            if (dateComparison !== 0) return dateComparison;
            
            // Если даты одинаковые, сортируем по ID (последние созданные первыми)
            // Это обеспечивает, что транзакции, созданные позже в тот же день, будут сверху
            return b.id - a.id;
        });

        // Обновляем отображение отфильтрованных транзакций
        const allTransactionsList = document.getElementById('allTransactions');
        if (allTransactionsList) {
            allTransactionsList.innerHTML = '';
            
            if (filteredTransactions.length === 0) {
                allTransactionsList.innerHTML = `
                    <div style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" style="fill: var(--text-secondary); margin-bottom: 20px;">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
                        </svg>
                        <h3 style="margin-bottom: 10px; color: var(--text-primary);">Транзакции не найдены</h3>
                        <p style="margin-bottom: 20px;">Попробуйте изменить параметры фильтра</p>
                    </div>
                `;
                return;
            }
            
            filteredTransactions.forEach(transaction => {
                const transactionElement = createTransactionElement(transaction);
                allTransactionsList.appendChild(transactionElement);
            });
        }
        
        // Обновляем месячную статистику
        updateMonthlyStats();
    }

    // Функция сброса фильтров
    function clearFilters() {
        // Сбрасываем все поля фильтров
        const filterFields = ['filterType', 'filterAccount', 'filterCategory', 'filterDateFrom', 'filterDateTo'];
        filterFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                if (field.type === 'select-one') {
                    field.selectedIndex = 0;
                } else {
                    field.value = '';
                }
            }
        });
        
        // Сворачиваем фильтр после сброса
        const filtersContent = document.getElementById('filtersAccordionContent');
        const filtersToggle = document.querySelector('[data-accordion="filters"] .filters-toggle');
        
        if (filtersContent && filtersToggle) {
            filtersContent.classList.remove('expanded');
            filtersContent.classList.add('collapsed');
            filtersToggle.classList.remove('expanded');
            filtersToggle.querySelector('span').textContent = 'Показать';
            localStorage.setItem('filtersAccordionState', 'collapsed');
        }
        
        // Перерисовываем все транзакции (с фильтрацией несуществующих счетов)
        renderTransactions();
    }

    // Функция инициализации фильтров
    // В фильтре по счетам показываются только существующие (не удаленные) счета
    function initFilters() {
        // Заполняем фильтр по счетам (только существующие счета)
        const filterAccount = document.getElementById('filterAccount');
        if (filterAccount) {
            filterAccount.innerHTML = '<option value="">Все счета</option>';
            // Фильтруем только существующие счета
            const existingAccounts = accounts.filter(account => account && account.id);
            existingAccounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account.id;
                option.textContent = account.name;
                filterAccount.appendChild(option);
            });
        }
        
        // Заполняем фильтр по категориям
        const filterCategory = document.getElementById('filterCategory');
        if (filterCategory) {
            filterCategory.innerHTML = '<option value="">Все категории</option>';
            
            // Добавляем категории расходов
            categories.expense.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                filterCategory.appendChild(option);
            });
            
            // Добавляем категории доходов
            categories.income.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                filterCategory.appendChild(option);
            });
        }
        
        // Добавляем обработчики событий для фильтров
        const filterInputs = ['filterType', 'filterAccount', 'filterCategory', 'filterDateFrom', 'filterDateTo'];
        filterInputs.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('change', filterTransactions);
                field.addEventListener('input', filterTransactions);
            }
        });
        
        // Обработчик для кнопки сброса фильтров
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', clearFilters);
        }

        // Аккордеоны теперь инициализируются новой системой
    }








    // ========================================
    // НОВАЯ СИСТЕМА АККОРДЕОНОВ
    // ========================================
    
    class AccordionManager {
        constructor() {
            this.accordions = new Map();
            this.init();
        }
        
        init() {
            this.findAccordions();
            this.setupEventListeners();
            this.loadStates();
        }
        
        findAccordions() {
            const headers = document.querySelectorAll('[data-accordion]');
            
            headers.forEach((header, index) => {
                const id = header.dataset.accordion;
                
                // Сначала пробуем стандартный способ
                let content = document.getElementById(id + 'AccordionContent');
                const toggle = header.querySelector('.accordion-toggle');
                
                // Если не нашли стандартным способом, пробуем альтернативный
                if (!content) {
                    content = header.parentElement.querySelector('.accordion-content');
                }
                
                if (!content || !toggle) {
                    return;
                }
                
                this.accordions.set(id, {
                    header,
                    content,
                    toggle,
                    isExpanded: false
                });
            });
        }
        
        setupEventListeners() {
            this.accordions.forEach((accordion, id) => {
                accordion.header.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggle(id);
                });
            });
        }
        
        loadStates() {
            this.accordions.forEach((accordion, id) => {
                const savedState = localStorage.getItem(`${id}AccordionState`);
                const shouldBeExpanded = savedState === 'expanded';
                
                // Для main-accounts: если нет сохраненного состояния, открываем по умолчанию
                if (id === 'main-accounts' && savedState === null) {
                    this.expand(id, false); // false = не сохранять в localStorage
                } else if (shouldBeExpanded) {
                    this.expand(id, false); // false = не сохранять в localStorage
                } else {
                    this.collapse(id, false); // false = не сохранять в localStorage
                }
            });
        }
        
        toggle(id) {
            const accordion = this.accordions.get(id);
            if (!accordion) return;
            
            if (accordion.isExpanded) {
                this.collapse(id);
            } else {
                this.expand(id);
            }
        }
        
        expand(id, saveState = true) {
            const accordion = this.accordions.get(id);
            if (!accordion) return;
            
            accordion.content.classList.remove('collapsed');
            accordion.content.classList.add('expanded');
            accordion.toggle.classList.add('expanded');
            accordion.isExpanded = true;
            
            this.updateToggleText(id, true);
            
            if (saveState) {
                localStorage.setItem(`${id}AccordionState`, 'expanded');
            }
        }
        
        collapse(id, saveState = true) {
            const accordion = this.accordions.get(id);
            if (!accordion) return;
            
            accordion.content.classList.remove('expanded');
            accordion.content.classList.add('collapsed');
            accordion.toggle.classList.remove('expanded');
            accordion.isExpanded = false;
            
            this.updateToggleText(id, false);
            
            if (saveState) {
                localStorage.setItem(`${id}AccordionState`, 'collapsed');
            }
        }
        
        updateToggleText(id, isExpanded) {
            const accordion = this.accordions.get(id);
            if (!accordion) return;
            
            const span = accordion.toggle.querySelector('span');
            if (!span) return;
            
            const texts = {
                'main-accounts': { open: 'Скрыть', closed: 'Показать' },
                'filters': { open: 'Скрыть', closed: 'Показать' },
                'currency': { open: 'Скрыть', closed: 'Настроить' },
                'accounts': { open: 'Скрыть', closed: 'Управлять' },
                'categories': { open: 'Скрыть', closed: 'Управлять' }
            };
            
            const textConfig = texts[id] || { open: 'Скрыть', closed: 'Показать' };
            span.textContent = isExpanded ? textConfig.open : textConfig.closed;
        }
        
        // Публичные методы для внешнего использования
        open(id) {
            this.expand(id);
        }
        
        close(id) {
            this.collapse(id);
        }
        
        isOpen(id) {
            const accordion = this.accordions.get(id);
            return accordion ? accordion.isExpanded : false;
        }
    }
    
    // Глобальный экземпляр менеджера аккордеонов
    let accordionManager = null;
    
    // Функция инициализации аккордеонов
    function initAccordions() {
        accordionManager = new AccordionManager();
    }
    
    // Глобальные функции для работы с аккордеонами
    function openAccordion(id) {
        if (accordionManager) {
            accordionManager.open(id);
        }
    }
    
    function closeAccordion(id) {
        if (accordionManager) {
            accordionManager.close(id);
        }
    }
    
    function toggleAccordion(id) {
        if (accordionManager) {
            accordionManager.toggle(id);
        }
    }
    
    function isAccordionOpen(id) {
        return accordionManager ? accordionManager.isOpen(id) : false;
    }
    



    // Создание элемента транзакции
    // Включает дату транзакции в формате ДД.ММ.ГГГГ
    function createTransactionElement(transaction) {
        const li = document.createElement('li');
        li.className = 'transaction-item';
        
        const category = categories[transaction.type].find(c => c.id === transaction.category);
        const account = accounts.find(a => a.id === transaction.accountId);
        
        // Получаем информацию о цели, если транзакция связана с ней
        let goalInfo = '';
        if (transaction.goalId && transaction.type === 'expense') {
            const goal = goals.find(g => g.id === parseInt(transaction.goalId));
            if (goal) {
                goalInfo = `<div class="transaction-goal">🎯 ${goal.name}</div>`;
            }
        }
        
        // Форматируем дату для отображения
        const transactionDate = new Date(transaction.date);
        const formattedDate = transactionDate.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        li.innerHTML = `
            <div class="transaction-content">
                <div class="transaction-info">
                    <div class="transaction-title">${transaction.description || 'Без описания'}</div>
                    <div class="transaction-category">${category ? category.icon + ' ' + category.name : 'Без категории'} • ${account?.name || 'Неизвестный счет'}</div>
                    <div class="transaction-date">📅 ${formattedDate}</div>
                    ${goalInfo}
                </div>
                <div class="transaction-amount ${transaction.type === 'income' ? 'income' : 'expense'}">
                    ${transaction.type === 'expense' ? '-' : '+'}${transaction.amount.toFixed(2)} ${account?.currency || 'RUB'}
                </div>
            </div>
            <button class="transaction-edit-icon" data-id="${transaction.id}" title="Редактировать">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
                </svg>
            </button>
        `;
        
        // Добавляем обработчик кликов прямо к кнопке редактирования
        const editButton = li.querySelector('.transaction-edit-icon');
        if (editButton) {
            editButton.addEventListener('click', function(e) {
                e.stopPropagation();
                const transactionId = parseInt(this.dataset.id);
                editTransaction(transactionId);
            });
        }
        
        return li;
    }

    // Рендер целей
    function renderGoals() {
        const activeGoalsList = document.getElementById('activeGoalsList');
        const completedGoalsList = document.getElementById('completedGoalsList');
        const addGoalBtn = document.getElementById('addGoalBtn');
        
        if (!activeGoalsList || !completedGoalsList) return;
        
        // Очистка списков
        activeGoalsList.innerHTML = '';
        completedGoalsList.innerHTML = '';
        
        // Определяем статус целей и разделяем их
        const now = new Date();
        const activeGoals = [];
        const completedGoals = [];
        
        goals.forEach(goal => {
            const progress = (goal.current / goal.target) * 100;
            const deadline = new Date(goal.deadline);
            
            // Цель считается завершенной, если достигнута 100% или истек срок
            if (progress >= 100 || deadline < now) {
                completedGoals.push(goal);
            } else {
                activeGoals.push(goal);
            }
        });
        
        // Скрываем или показываем кнопку "Добавить цель" только когда есть актуальные цели
        if (addGoalBtn) {
            if (activeGoals.length > 0) {
                addGoalBtn.style.display = 'inline-flex';
            } else {
                addGoalBtn.style.display = 'none';
            }
        }
        
        // Рендер активных целей
        if (activeGoals.length > 0) {
            activeGoalsList.innerHTML = '';
            activeGoals.forEach(goal => {
                const goalElement = createGoalElement(goal, false);
                activeGoalsList.appendChild(goalElement);
            });
        }
        
        // Рендер завершенных целей
        const clearCompletedGoalsBtn = document.getElementById('clearCompletedGoalsBtn');
        
        // Очищаем список завершенных целей
        completedGoalsList.innerHTML = '';
        
        if (completedGoals.length > 0) {
            // Добавляем завершенные цели
            completedGoals.forEach(goal => {
                const goalElement = createGoalElement(goal, true);
                completedGoalsList.appendChild(goalElement);
            });
            
            // Показываем кнопку очистки, если есть завершенные цели
            if (clearCompletedGoalsBtn) {
                clearCompletedGoalsBtn.style.display = 'inline-flex';
            }
        } else {
            // Скрываем кнопку очистки, если нет завершенных целей
            if (clearCompletedGoalsBtn) {
                clearCompletedGoalsBtn.style.display = 'none';
            }
        }
        
        // Обновление счетчиков целей в статистике
        updateGoalsCounters();
        
        // Показываем заглушки, если они нужны
        showPlaceholdersIfNeeded();
    }

    // Функция для показа заглушек при необходимости
    function showPlaceholdersIfNeeded() {
        const activeGoalsList = document.getElementById('activeGoalsList');
        const completedGoalsList = document.getElementById('completedGoalsList');
        
        if (!activeGoalsList || !completedGoalsList) return;
        
        // Определяем статус целей
        const activeGoals = goals.filter(goal => {
            const progress = (goal.current / goal.target) * 100;
            const deadline = new Date(goal.deadline);
            const now = new Date();
            return progress < 100 && deadline >= now;
        });
        
        const completedGoals = goals.filter(goal => {
            const progress = (goal.current / goal.target) * 100;
            const deadline = new Date(goal.deadline);
            const now = new Date();
            return progress >= 100 || deadline < now;
        });
        
        // Если нет целей вообще, показываем заглушку в активных целях
        if (goals.length === 0 && activeGoalsList.children.length === 0) {
            activeGoalsList.innerHTML = `
                <div class="completed-goals-placeholder" style="background: linear-gradient(135deg, rgba(76, 175, 80, 0.05), rgba(76, 175, 80, 0.05)); border-color: rgba(76, 175, 80, 0.2);">
                    <h3>У вас пока нет финансовых целей</h3>
                    <p>Создайте свою первую цель для начала планирования</p>
                    <button class="btn btn-primary create-goal-btn" onclick="openGoalModal()">
                        Создать цель +
                    </button>
                </div>
            `;
        }
        // Если нет активных целей, но есть завершенные, показываем заглушку в активных целях
        else if (activeGoals.length === 0 && goals.length > 0 && activeGoalsList.children.length === 0) {
            activeGoalsList.innerHTML = `
                <div class="completed-goals-placeholder" style="background: linear-gradient(135deg, rgba(76, 175, 80, 0.05), rgba(76, 175, 80, 0.05)); border-color: rgba(76, 175, 80, 0.2);">
                    <h3>Нет активных целей</h3>
                    <p>Все ваши цели завершены или истекли</p>
                    <button class="btn btn-primary create-goal-btn" onclick="openGoalModal()">
                        Создать цель +
                    </button>
                </div>
            `;
        }
        
        // Если нет завершенных целей, показываем заглушку в завершенных целях
        if (completedGoals.length === 0 && completedGoalsList.children.length === 0) {
            // Если есть активные цели, не показываем кнопку "Создать цель +"
            if (activeGoals.length > 0) {
                completedGoalsList.innerHTML = `
                    <div class="completed-goals-placeholder">
                        <h3>Нет завершенных целей</h3>
                        <p>Завершите свою первую цель</p>
                    </div>
                `;
            } else {
                completedGoalsList.innerHTML = `
                    <div class="completed-goals-placeholder">
                        <h3>Нет завершенных целей</h3>
                        <p>Завершите свою первую цель</p>
                        <button class="btn btn-primary create-goal-btn" onclick="openGoalModal()">
                            Создать цель +
                        </button>
                    </div>
                `;
            }
        }
        
        // Обновляем видимость кнопки "Добавить цель" в зависимости от наличия актуальных целей
        const addGoalBtn = document.getElementById('addGoalBtn');
        if (addGoalBtn) {
            if (activeGoals.length > 0) {
                addGoalBtn.style.display = 'inline-flex';
            } else {
                addGoalBtn.style.display = 'none';
            }
        }
    }

    // Функция для очистки всех завершенных целей
    function clearCompletedGoals() {
        if (confirm('Вы уверены, что хотите удалить все завершенные цели? Это действие нельзя отменить.')) {
            // Фильтруем цели, оставляя только активные
            goals = goals.filter(goal => {
                const progress = (goal.current / goal.target) * 100;
                const deadline = new Date(goal.deadline);
                const now = new Date();
                
                // Оставляем только те цели, которые не завершены и не истекли
                return progress < 100 && deadline >= now;
            });
            
            // Сохраняем обновленный список целей
            updateLocalStorage();
            
            // Скрываем кнопку очистки
            const clearCompletedGoalsBtn = document.getElementById('clearCompletedGoalsBtn');
            if (clearCompletedGoalsBtn) {
                clearCompletedGoalsBtn.style.display = 'none';
            }
            
            // Показываем заглушку "Нет завершенных целей"
            const completedGoalsList = document.getElementById('completedGoalsList');
            if (completedGoalsList) {
                // Проверяем, есть ли активные цели после очистки
                const activeGoalsAfterClear = goals.filter(goal => {
                    const progress = (goal.current / goal.target) * 100;
                    const deadline = new Date(goal.deadline);
                    const now = new Date();
                    return progress < 100 && deadline >= now;
                });
                
                // Если есть активные цели, не показываем кнопку "Создать цель +"
                if (activeGoalsAfterClear.length > 0) {
                    completedGoalsList.innerHTML = `
                        <div class="completed-goals-placeholder">
                            <h3>Нет завершенных целей</h3>
                            <p>Завершите свою первую цель</p>
                        </div>
                    `;
                } else {
                    completedGoalsList.innerHTML = `
                        <div class="completed-goals-placeholder">
                            <h3>Нет завершенных целей</h3>
                            <p>Завершите свою первую цель</p>
                            <button class="btn btn-primary create-goal-btn" onclick="openGoalModal()">
                                Создать цель +
                            </button>
                        </div>
                    `;
                }
            }
            
            // Обновляем счетчики на дашборде
            updateDashboard();
            
            // Показываем заглушки при необходимости
            showPlaceholdersIfNeeded();
            
            console.log('Все завершенные цели удалены');
        }
    }

    // Создание элемента цели
    function createGoalElement(goal, isCompleted) {
        const progress = (goal.current / goal.target) * 100;
        const goalCard = document.createElement('div');
        goalCard.className = 'goal-card';
        
        // Добавляем класс для завершенных целей
        if (isCompleted) {
            goalCard.classList.add('completed-goal');
        }
        
        // Форматируем дату
        const deadline = new Date(goal.deadline);
        const deadlineFormatted = deadline.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        goalCard.innerHTML = `
            <div class="goal-header">
                <h3 class="goal-title">${goal.name}</h3>
                <span class="goal-status ${isCompleted ? 'completed' : 'active'}">
                    ${isCompleted ? 'Завершено' : 'Активно'}
                </span>
            </div>
            
            <div class="goal-stats">
                <div class="goal-stat-item">
                    <span class="goal-stat-value">${goal.current.toFixed(2)}</span>
                    <span class="goal-stat-label">Накоплено (₽)</span>
                </div>
                <div class="goal-stat-item">
                    <span class="goal-stat-value">${goal.target.toFixed(2)}</span>
                    <span class="goal-stat-label">Цель (₽)</span>
                </div>
            </div>
            
            <div class="goal-progress">
                <div class="goal-progress-header">
                    <span class="goal-progress-percentage">${progress.toFixed(0)}%</span>
                    <span class="goal-progress-deadline">
                        ${isCompleted ? 'Завершено' : `До ${deadlineFormatted}`}
                    </span>
                </div>
                <div class="goal-progress-bar">
                    <div class="progress-bar" style="width: ${progress}%; ${isCompleted ? 'background: linear-gradient(90deg, #22c55e, #16a34a);' : ''}"></div>
                </div>
            </div>
            
            <div class="goal-actions">
                ${!isCompleted && progress < 100 ? `
                    <button class="btn btn-primary btn-sm pay-goal" data-id="${goal.id}" data-target="${goal.target}" data-current="${goal.current}" title="Оплатить с баланса">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        Оплатить
                    </button>
                ` : ''}
                <button class="btn btn-outline btn-sm edit-goal" data-id="${goal.id}" title="Редактировать">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
                        <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
                    </svg>
                    Редактировать
                </button>
            </div>
        `;
        
        return goalCard;
    }

    // Обновление статистики
    function updateStats() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Фильтрация транзакций за текущий месяц
        const monthTransactions = transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transactionDate.getMonth() === currentMonth && 
                   transactionDate.getFullYear() === currentYear;
        });
        
        // Расчет доходов и расходов
        const monthExpenses = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
            
        const monthIncome = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        // Обновление DOM для финансовых показателей
        const monthExpensesEl = document.getElementById('monthExpenses');
        const monthIncomeEl = document.getElementById('monthIncome');
        
        if (monthExpensesEl) monthExpensesEl.textContent = `${monthExpenses.toFixed(2)} ₽`;
        if (monthIncomeEl) monthIncomeEl.textContent = `${monthIncome.toFixed(2)} ₽`;
        
        // Обновление счетчиков целей
        updateGoalsCounters();
    }

    // Обновление счетчиков целей
    function updateGoalsCounters() {
        const now = new Date();
        const activeGoals = [];
        const completedGoals = [];
        
        goals.forEach(goal => {
            const progress = (goal.current / goal.target) * 100;
            const deadline = new Date(goal.deadline);
            
            // Цель считается завершенной, если достигнута 100% или истек срок
            if (progress >= 100 || deadline < now) {
                completedGoals.push(goal);
            } else {
                activeGoals.push(goal);
            }
        });
        
        // Обновление DOM
        const activeGoalsCountEl = document.getElementById('activeGoalsCount');
        const completedGoalsCountEl = document.getElementById('completedGoalsCount');
        
        if (activeGoalsCountEl) {
            activeGoalsCountEl.textContent = activeGoals.length;
        }
        
        if (completedGoalsCountEl) {
            completedGoalsCountEl.textContent = completedGoals.length;
        }
    }

    // Инициализация графиков
    function initCharts() {
        // График категорий расходов
        const categoryCanvas = document.getElementById('categoryChart');
        if (categoryCanvas) {
            const categoryCtx = categoryCanvas.getContext('2d');
            updateCategoryChart(categoryCtx);
        }
        
        // График доходов/расходов
        const incomeExpenseCanvas = document.getElementById('incomeExpenseChart');
        if (incomeExpenseCanvas) {
            const incomeExpenseCtx = incomeExpenseCanvas.getContext('2d');
            updateIncomeExpenseChart(incomeExpenseCtx);
        }
        
        // График целей
        const goalsCanvas = document.getElementById('goalsChart');
        if (goalsCanvas) {
            const goalsCtx = goalsCanvas.getContext('2d');
            updateGoalsChart(goalsCtx);
        }
        

    }

    // Обновление графика категорий
    function updateCategoryChart(ctx, chartType = 'doughnut') {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Фильтрация расходов за текущий месяц
        const monthExpenses = transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transaction.type === 'expense' &&
                   transactionDate.getMonth() === currentMonth && 
                   transactionDate.getFullYear() === currentYear;
        });
        
        // Группировка по категориям
        const expensesByCategory = {};
        monthExpenses.forEach(expense => {
            if (!expensesByCategory[expense.category]) {
                expensesByCategory[expense.category] = 0;
            }
            expensesByCategory[expense.category] += expense.amount;
        });
        
        // Подготовка данных для графика
        const labels = [];
        const data = [];
        const backgroundColors = [
            '#4361ee', '#3a0ca3', '#4cc9f0', '#f72585', '#fca311', '#4895ef', '#7209b7',
            '#06d6a0', '#118ab2', '#ef476f', '#ffd166', '#073b4c', '#5e60ce', '#5a189a'
        ];
        
        Object.keys(expensesByCategory).forEach((categoryId, index) => {
            const category = categories.expense.find(c => c.id === categoryId);
            if (category) {
                labels.push(category.name);
                data.push(expensesByCategory[categoryId]);
            }
        });
        
        // Создание или обновление графика
        if (charts.categoryChart) {
            charts.categoryChart.destroy();
        }
        
        charts.categoryChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: chartType === 'bar' ? 1 : 0,
                    borderColor: chartType === 'bar' ? 'rgba(0,0,0,0.1)' : undefined
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: chartType === 'bar' ? 'top' : 'right',
                        labels: {
                            font: {
                                family: 'Inter'
                            },
                            color: getComputedStyle(document.body).getPropertyValue('--text-primary')
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.raw.toFixed(2)} ₽`;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }

    // Обновление графика доходов/расходов
    function updateIncomeExpenseChart(ctx, chartType = 'bar') {
        const now = new Date();
        const months = [];
        const incomeData = [];
        const expensesData = [];
        
        // Получение данных за последние 6 месяцев
        for (let i = 5; i >= 0; i--) {
            const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = month.toLocaleString('ru', { month: 'short' });
            months.push(monthName);
            
            const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
            const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
            
            const monthTransactions = transactions.filter(transaction => {
                const transactionDate = new Date(transaction.date);
                return transactionDate >= monthStart && transactionDate <= monthEnd;
            });
            
            const income = monthTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);
                
            const expenses = monthTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);
            
            incomeData.push(income);
            expensesData.push(expenses);
        }
        
        // Создание или обновление графика
        if (charts.incomeExpenseChart) {
            charts.incomeExpenseChart.destroy();
        }
        
        const datasets = [
            {
                label: 'Доходы',
                data: incomeData,
                backgroundColor: '#4cc9f0',
                borderWidth: chartType === 'line' ? 2 : 0,
                borderColor: chartType === 'line' ? '#4cc9f0' : undefined,
                borderRadius: chartType === 'bar' ? 4 : undefined,
                fill: chartType === 'line' ? false : undefined,
                tension: chartType === 'line' ? 0.4 : undefined
            },
            {
                label: 'Расходы',
                data: expensesData,
                backgroundColor: '#f72585',
                borderWidth: chartType === 'line' ? 2 : 0,
                borderColor: chartType === 'line' ? '#f72585' : undefined,
                borderRadius: chartType === 'bar' ? 4 : undefined,
                fill: chartType === 'line' ? false : undefined,
                tension: chartType === 'line' ? 0.4 : undefined
            }
        ];
        
        charts.incomeExpenseChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: months,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: chartType === 'radar' ? undefined : {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary')
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                            callback: function(value) {
                                return value + ' ₽';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                family: 'Inter'
                            },
                            color: getComputedStyle(document.body).getPropertyValue('--text-primary')
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw.toFixed(2)} ₽`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }



    // Обновление графика целей
    function updateGoalsChart(ctx, chartType = 'bar') {
        const labels = goals.map(goal => goal.name);
        const targetData = goals.map(goal => goal.target);
        const currentData = goals.map(goal => goal.current);
        
        // Создание или обновление графика
        if (charts.goalsChart) {
            charts.goalsChart.destroy();
        }
        
        const datasets = [
            {
                label: 'Целевая сумма',
                data: targetData,
                backgroundColor: chartType === 'doughnut' ? 'rgba(67,97, 238, 0.2)' : 'rgba(67,97, 238, 0.2)',
                borderColor: chartType === 'doughnut' ? '#4361ee' : '#4361ee',
                borderWidth: chartType === 'doughnut' ? 2 : 1,
                borderRadius: chartType === 'bar' ? 4 : undefined,
                fill: chartType === 'line' ? false : undefined,
                tension: chartType === 'line' ? 0.4 : undefined
            },
            {
                label: 'Текущий прогресс',
                data: currentData,
                backgroundColor: chartType === 'doughnut' ? '#4cc9f0' : '#4cc9f0',
                borderWidth: chartType === 'doughnut' ? 2 : 0,
                borderRadius: chartType === 'bar' ? 4 : undefined,
                fill: chartType === 'line' ? false : undefined,
                tension: chartType === 'line' ? 0.4 : undefined
            }
        ];
        
        charts.goalsChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: chartType === 'doughnut' ? [{
                    label: 'Цели',
                    data: currentData,
                    backgroundColor: ['#4361ee', '#4cc9f0', '#f72585', '#fca311', '#7209b7'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }] : datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: chartType === 'doughnut' ? undefined : {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary')
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                            callback: function(value) {
                                return value + ' ₽';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: chartType === 'doughnut' ? 'right' : 'top',
                        labels: {
                            font: {
                                family: 'Inter'
                            },
                            color: getComputedStyle(document.body).getPropertyValue('--text-primary')
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.raw.toFixed(2)} ₽`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    // Обновление месячной статистики с расчетом изменений
    function updateMonthlyStats() {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        // Получаем данные предыдущего месяца
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        // Фильтруем транзакции за текущий месяц
        const monthlyTransactions = transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transactionDate.getMonth() === currentMonth && 
                   transactionDate.getFullYear() === currentYear;
        });
        
        // Фильтруем транзакции за предыдущий месяц
        const previousMonthTransactions = transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transactionDate.getMonth() === previousMonth && 
                   transactionDate.getFullYear() === previousYear;
        });
        
        // Считаем расходы и доходы за текущий месяц
        let monthlyExpenses = 0;
        let monthlyIncome = 0;
        
        monthlyTransactions.forEach(transaction => {
            if (transaction.type === 'expense') {
                monthlyExpenses += transaction.amount;
            } else if (transaction.type === 'income') {
                monthlyIncome += transaction.amount;
            }
        });
        
        // Считаем расходы и доходы за предыдущий месяц
        let previousMonthExpenses = 0;
        let previousMonthIncome = 0;
        
        previousMonthTransactions.forEach(transaction => {
            if (transaction.type === 'expense') {
                previousMonthExpenses += transaction.amount;
            } else if (transaction.type === 'income') {
                previousMonthIncome += transaction.amount;
            }
        });
        
        // Рассчитываем процентные изменения
        const expenseChange = previousMonthExpenses > 0 ? 
            ((monthlyExpenses - previousMonthExpenses) / previousMonthExpenses) * 100 : 0;
        const incomeChange = previousMonthIncome > 0 ? 
            ((monthlyIncome - previousMonthIncome) / previousMonthIncome) * 100 : 0;
        

        
        // Обновляем отображение сумм
        const monthlyExpensesElement = document.getElementById('monthlyExpenses');
        const monthlyIncomeElement = document.getElementById('monthlyIncome');
        
        if (monthlyExpensesElement) {
            monthlyExpensesElement.textContent = `${monthlyExpenses.toFixed(2)} ₽`;
        }
        
        if (monthlyIncomeElement) {
            monthlyIncomeElement.textContent = `${monthlyIncome.toFixed(2)} ₽`;
        }
        
        // Обновляем отображение изменений
        const expenseChangeElement = document.getElementById('expenseChange');
        const incomeChangeElement = document.getElementById('incomeChange');
        
        if (expenseChangeElement) {
            if (expenseChange > 0) {
                // Больше трат = красный
                expenseChangeElement.textContent = `+${expenseChange.toFixed(1)}%`;
                expenseChangeElement.className = 'stat-square expense-square';

            } else if (expenseChange < 0) {
                // Меньше трат = зеленый
                expenseChangeElement.textContent = `${expenseChange.toFixed(1)}%`;
                expenseChangeElement.className = 'stat-square income-square';

            } else {
                expenseChangeElement.textContent = '0%';
                expenseChangeElement.className = 'stat-square expense-square';

            }
        }
        
        if (incomeChangeElement) {
            if (incomeChange > 0) {
                // Больше доходов = зеленый
                incomeChangeElement.textContent = `+${incomeChange.toFixed(1)}%`;
                incomeChangeElement.className = 'stat-square income-square';

            } else if (incomeChange < 0) {
                // Меньше доходов = красный
                incomeChangeElement.textContent = `${incomeChange.toFixed(1)}%`;
                incomeChangeElement.className = 'stat-square expense-square';

            } else {
                incomeChangeElement.textContent = '0%';
                incomeChangeElement.className = 'stat-square income-square';

            }
        }
    }

    // Обновление дашборда
    function updateDashboard() {
        updateBalance();
        updateStats();
        updateMonthlyStats();
        renderTransactions();
        
        // Обновляем графики только если они существуют
        const categoryCanvas = document.getElementById('categoryChart');
        if (categoryCanvas) {
            updateCategoryChart(categoryCanvas.getContext('2d'));
        }
        
        const incomeExpenseCanvas = document.getElementById('incomeExpenseChart');
        if (incomeExpenseCanvas) {
            updateIncomeExpenseChart(incomeExpenseCanvas.getContext('2d'));
        }
        
        const goalsCanvas = document.getElementById('goalsChart');
        if (goalsCanvas) {
            updateGoalsChart(goalsCanvas.getContext('2d'));
        }
        
        // Показываем заглушки при необходимости
        showPlaceholdersIfNeeded();
    }

    // Функция изменения типа графика
    function updateChartType(chartName, chartType) {
        // Уничтожаем старый график
        if (charts[chartName + 'Chart']) {
            charts[chartName + 'Chart'].destroy();
            charts[chartName + 'Chart'] = null;
        }
        
        // Пересоздаем график с новым типом
        const canvas = document.getElementById(chartName + 'Chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            
            switch (chartName) {
                case 'category':
                    updateCategoryChart(ctx, chartType);
                    break;
                case 'incomeExpense':
                    updateIncomeExpenseChart(ctx, chartType);
                    break;
                case 'goals':
                    updateGoalsChart(ctx, chartType);
                    break;
            }
        }
    }

    // Настройка обработчиков событий
    function setupEventListeners() {
        // Переключение темы
        const themeCheckbox = document.getElementById('themeCheckbox');
        if (themeCheckbox) {
            themeCheckbox.addEventListener('change', function() {
                document.body.classList.toggle('dark-mode', this.checked);
                localStorage.setItem('darkMode', this.checked);
                
                // Обновление графиков при смене темы
                Object.values(charts).forEach(chart => chart.update());
            });

            // Проверка сохраненной темы
            if (localStorage.getItem('darkMode') === 'true') {
                themeCheckbox.checked = true;
                document.body.classList.add('dark-mode');
            }
        }





        // Аккордеоны теперь обрабатываются новой простой системой в initSimpleAccordions()

        // Переключение вкладок
        document.querySelectorAll('.tab-item').forEach(item => {
            item.addEventListener('click', function() {
                // Убрать активный класс у всех вкладок
                document.querySelectorAll('.tab-item').forEach(i => i.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(t => {
                    t.classList.remove('active');
                    t.classList.remove('fade-in');
                });
                
                // Добавить активный класс текущей вкладке
                this.classList.add('active');
                const tabId = this.dataset.tab + '-tab';
                const tabElement = document.getElementById(tabId);
                if (tabElement) {
                    tabElement.classList.add('active');
                    // Добавляем анимацию появления
                    setTimeout(() => {
                        tabElement.classList.add('fade-in');
                    }, 50);
                }
                
                // Обновление индикатора активного таба
                updateTabIndicator(this);
                
                // Плавная прокрутка к активному табу
                const tabsScroll = document.querySelector('.tabs-scroll');
                if (tabsScroll) {
                    const activeTab = this;
                    const scrollLeft = activeTab.offsetLeft - (tabsScroll.offsetWidth / 2) + (activeTab.offsetWidth / 2);
                    tabsScroll.scrollTo({
                        left: scrollLeft,
                        behavior: 'smooth'
                    });
                }
            });
        });



        // Кнопки навигации для прокрутки табов
        const tabsPrevBtn = document.getElementById('tabsPrevBtn');
        const tabsNextBtn = document.getElementById('tabsNextBtn');
        const tabsScroll = document.querySelector('.tabs-scroll');

        if (tabsPrevBtn && tabsNextBtn && tabsScroll) {
            // Прокрутка влево
            tabsPrevBtn.addEventListener('click', () => {
                tabsScroll.scrollBy({
                    left: -200,
                    behavior: 'smooth'
                });
            });

            // Прокрутка вправо
            tabsNextBtn.addEventListener('click', () => {
                tabsScroll.scrollBy({
                    left: 200,
                    behavior: 'smooth'
                });
            });

            // Обновление видимости кнопок навигации
            function updateNavButtons() {
                const isAtStart = tabsScroll.scrollLeft <= 0;
                const isAtEnd = tabsScroll.scrollLeft >= tabsScroll.scrollWidth - tabsScroll.offsetWidth;
                
                tabsPrevBtn.style.display = isAtStart ? 'none' : 'flex';
                tabsNextBtn.style.display = isAtEnd ? 'none' : 'flex';
            }

            // Слушатель прокрутки
            tabsScroll.addEventListener('scroll', updateNavButtons);
            
            // Начальная проверка
            updateNavButtons();
        }



        // Свич для включения/выключения курсов валют
        const currencyToggleSwitch = document.getElementById('currencyToggleSwitch');
        if (currencyToggleSwitch) {
            currencyToggleSwitch.addEventListener('change', function() {
                const settingsContent = document.getElementById('currencySettingsContent');
                if (this.checked) {
                    // Показываем настройки валют
                    settingsContent.style.display = 'block';
                    setTimeout(() => {
                        settingsContent.classList.add('show');
                    }, 10);
                    localStorage.setItem('currencyToggleState', 'true');
                } else {
                    // Скрываем настройки валют
                    settingsContent.classList.remove('show');
                    setTimeout(() => {
                        settingsContent.style.display = 'none';
                    }, 300);
                    localStorage.setItem('currencyToggleState', 'false');
                    
                    // Скрываем блок курсов валют на странице
                    const currencyContainer = document.getElementById('currencyRatesInline');
                    if (currencyContainer) {
                        currencyContainer.style.display = 'none';
                    }
                }
            });
        }



        // Обработчики событий для чекбоксов валют
        document.addEventListener('change', function(e) {
            if (e.target.matches('.currency-checkboxes input[type="checkbox"]')) {
                // Автоматически сохраняем настройки при изменении чекбокса
                setTimeout(() => {
                    saveCurrencySettings();
                }, 100);
            }
        });







        // Выбор счета - отключено, теперь счета выбираются только через выпадающий список в транзакциях
        // document.addEventListener('click', function(e) {
        //     if (e.target.closest('.account-item')) {
        //         const accountItem = e.target.closest('.account-item');
        //         const accountId = parseInt(accountItem.dataset.id);
        //         
        //         // Обновить активный счет
        //         document.querySelectorAll('.account-item').forEach(item => {
        //             item.classList.remove('active');
        //         });
        //         accountItem.classList.add('active');
        //         
        //         currentAccountId = accountId;
        //         updateDashboard();
        //     }
        // });

        // Кнопки добавления
        const addExpenseBtn = document.getElementById('addExpenseBtn');
        const addIncomeBtn = document.getElementById('addIncomeBtn');
        const addGoalBtn = document.getElementById('addGoalBtn');
        const addAccountBtn = document.getElementById('addAccountBtn');
        
        if (addExpenseBtn) addExpenseBtn.addEventListener('click', openExpenseModal);
        if (addIncomeBtn) addIncomeBtn.addEventListener('click', openIncomeModal);
        if (addGoalBtn) addGoalBtn.addEventListener('click', openGoalModal);
        if (addAccountBtn) addAccountBtn.addEventListener('click', openAccountModal);

        // Закрытие модальных окон
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', closeAllModals);
        });

        // Клик вне модального окна
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeAllModals();
                }
            });
        });

        // Формы
        const transactionForm = document.getElementById('transactionForm');
        const goalForm = document.getElementById('goalForm');
        const accountForm = document.getElementById('accountForm');
        const incomeForm = document.getElementById('incomeForm');
        const expenseForm = document.getElementById('expenseForm');
        
        // Удаляем старые обработчики перед добавлением новых
        if (transactionForm) {
            transactionForm.removeEventListener('submit', handleTransactionSubmit);
            transactionForm.addEventListener('submit', handleTransactionSubmit);
        }
        if (goalForm) {
            goalForm.removeEventListener('submit', handleGoalSubmit);
            goalForm.addEventListener('submit', handleGoalSubmit);
        }
        if (accountForm) {
            accountForm.removeEventListener('submit', handleAccountSubmit);
            accountForm.addEventListener('submit', handleAccountSubmit);
        }
        if (incomeForm) {
            // Удаляем старый обработчик, если он существует
            if (incomeSubmitHandler) {
                incomeForm.removeEventListener('submit', incomeSubmitHandler);
            }
            // Создаем новый обработчик и сохраняем ссылку
            incomeSubmitHandler = (e) => { e.preventDefault(); handleIncomeSubmit(); };
            incomeForm.addEventListener('submit', incomeSubmitHandler);
        }
        if (expenseForm) {
            // Удаляем старый обработчик, если он существует
            if (expenseSubmitHandler) {
                expenseForm.removeEventListener('submit', expenseSubmitHandler);
            }
            // Создаем новый обработчик и сохраняем ссылку
            expenseSubmitHandler = (e) => { e.preventDefault(); handleExpenseSubmit(); };
            expenseForm.addEventListener('submit', expenseSubmitHandler);
        }

        // Форма категорий
        const categoryForm = document.getElementById('categoryForm');
        if (categoryForm) {
            categoryForm.removeEventListener('submit', handleCategorySubmit);
            categoryForm.addEventListener('submit', handleCategorySubmit);
        }

        // Форма перевода
        const transferForm = document.getElementById('transferForm');
        if (transferForm) {
            transferForm.removeEventListener('submit', handleTransferSubmit);
            transferForm.addEventListener('submit', handleTransferSubmit);
        }

        // Кнопка удаления категории в модальном окне
        const deleteCategoryBtn = document.getElementById('deleteCategoryBtn');
        if (deleteCategoryBtn) {
            deleteCategoryBtn.addEventListener('click', function() {
                const categoryId = document.getElementById('categoryId').value;
                const categoryTypeSelect = document.getElementById('categoryTypeSelect');
                const categoryType = categoryTypeSelect ? categoryTypeSelect.value : document.getElementById('categoryType').value;
                if (categoryId && categoryType) {
                    deleteCategory(categoryId, categoryType);
                    closeAllModals();
                }
            });
        }

        // Кнопка удаления счета в модальном окне
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', function() {
                const accountId = document.getElementById('accountId').value;
                if (accountId) {
                    // Вызываем функцию удаления
                    deleteAccount(parseInt(accountId));
                    
                    // Принудительно обновляем интерфейс
                    setTimeout(() => {
                        renderAccounts();
                        renderTransactions();
                        updateDashboard();
                        closeAllModals();
                    }, 100);
                }
            });
        }

        // Кнопка удаления цели в модальном окне
        const deleteGoalBtn = document.getElementById('deleteGoalBtn');
        if (deleteGoalBtn) {
            deleteGoalBtn.addEventListener('click', function() {
                const goalId = document.getElementById('goalId').value;
                if (goalId) {
                    deleteGoal(parseInt(goalId));
                    closeAllModals();
                }
            });
        }

        // Кнопка очистки всех завершенных целей
        const clearCompletedGoalsBtn = document.getElementById('clearCompletedGoalsBtn');
        if (clearCompletedGoalsBtn) {
            clearCompletedGoalsBtn.addEventListener('click', clearCompletedGoals);
        }



        // Обработчики для модального окна оплаты цели
        const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
        if (confirmPaymentBtn) {
            confirmPaymentBtn.addEventListener('click', confirmGoalPayment);
        }

        // Обработчики для кнопок-подсказок сумм
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('payment-hint-btn')) {
                const amount = parseFloat(e.target.dataset.amount);
                const paymentAmount = document.getElementById('paymentAmount');
                if (paymentAmount) {
                    paymentAmount.value = amount;
                }
            }
            
            // Обработчик для кнопки с остатком
            if (e.target.closest('.payment-hint-remaining')) {
                const remainingAmountBtn = e.target.closest('.payment-hint-remaining');
                const remainingAmountValue = remainingAmountBtn.querySelector('.remaining-amount-value');
                if (remainingAmountValue) {
                    const amountText = remainingAmountValue.textContent;
                    const amount = parseFloat(amountText.replace(/[^\d.-]/g, ''));
                    const paymentAmount = document.getElementById('paymentAmount');
                    if (paymentAmount && !isNaN(amount)) {
                        paymentAmount.value = amount;
                    }
                }
            }

            // Обработчик для кнопок с подсказками иконок категорий
            if (e.target.classList.contains('icon-hint-btn')) {
                const icon = e.target.dataset.icon;
                if (icon) {
                    const categoryIcon = document.getElementById('categoryIcon');
                    if (categoryIcon) {
                        categoryIcon.value = icon;
                    }
                }
            }
        });

        // Обработчик изменения выбранного счета
        document.addEventListener('change', function(e) {
            if (e.target.id === 'paymentAccount') {
                updateSelectedAccountBalance();
            }
        });



        // Обработчик изменения выбора цели
        document.addEventListener('change', function(e) {
            if (e.target.id === 'transactionGoal') {
                const categorySelect = document.getElementById('transactionCategory');
                if (categorySelect && e.target.value) {
                    // Автоматически устанавливаем категорию "Цели"
                    categorySelect.value = 'goals';
                    // Обновляем отображение целей
                    updateGoalSelection();
                }
            }
        });

        // Обработчик для кнопки добавления категории
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => openCategoryModal('expense'));
        }

        // Обработчики для навигации в модальном окне дохода
        const incomeNextBtn = document.getElementById('incomeNextBtn');
        const incomePrevBtn = document.getElementById('incomePrevBtn');
        const incomeSubmitBtn = document.getElementById('incomeSubmitBtn');

        if (incomeNextBtn) {
            incomeNextBtn.addEventListener('click', function() {
                const currentStep = getCurrentIncomeStep();
                if (validateIncomeStep(currentStep)) {
                    showIncomeStep(currentStep + 1, 'forward');
                }
            });
        }

        if (incomePrevBtn) {
            incomePrevBtn.addEventListener('click', function() {
                const currentStep = getCurrentIncomeStep();
                showIncomeStep(currentStep - 1, 'backward');
            });
        }

        // Обработчик для кнопки удаления дохода
        const incomeDeleteBtn = document.getElementById('incomeDeleteBtn');
        if (incomeDeleteBtn) {
            incomeDeleteBtn.addEventListener('click', function() {
                const incomeId = document.getElementById('incomeId').value;
                if (incomeId) {
                    deleteTransaction(parseInt(incomeId));
                    closeAllModals();
                }
            });
        }

        // Убрано дублирующееся событие - форма уже обрабатывается через incomeForm.addEventListener

        // Обработчики для навигации в модальном окне расхода
        const expenseNextBtn = document.getElementById('expenseNextBtn');
        const expensePrevBtn = document.getElementById('expensePrevBtn');
        const expenseSubmitBtn = document.getElementById('expenseSubmitBtn');

        if (expenseNextBtn) {
            expenseNextBtn.addEventListener('click', function() {
                const currentStep = getCurrentExpenseStep();
                if (validateExpenseStep(currentStep)) {
                    showExpenseStep(currentStep + 1, 'forward');
                }
            });
        }

        if (expensePrevBtn) {
            expensePrevBtn.addEventListener('click', function() {
                const currentStep = getCurrentExpenseStep();
                showExpenseStep(currentStep - 1, 'backward');
            });
        }

        // Обработчик для кнопки удаления расхода
        const expenseDeleteBtn = document.getElementById('expenseDeleteBtn');
        if (expenseDeleteBtn) {
            expenseDeleteBtn.addEventListener('click', function() {
                const expenseId = document.getElementById('expenseId').value;
                if (expenseId) {
                    deleteTransaction(parseInt(expenseId));
                    closeAllModals();
                }
            });
        }

        // Убрано дублирующееся событие - форма уже обрабатывается через expenseForm.addEventListener

        // Обработчик для закрытия модального окна категории
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('close-modal') && e.target.closest('#categoryModal')) {
                closeCategoryModal();
            }
            
            // Закрытие модального окна категории при клике вне его содержимого
            if (e.target.id === 'categoryModal') {
                closeCategoryModal();
            }
        });

        // Обработчик для синхронизации выбора типа категории
        document.addEventListener('change', function(e) {
            if (e.target.id === 'categoryTypeSelect') {
                const categoryType = document.getElementById('categoryType');
                if (categoryType) {
                    categoryType.value = e.target.value;
                }
            }
        });



        // Валидация поля суммы оплаты
        document.addEventListener('input', function(e) {
            if (e.target.id === 'paymentAmount') {
                const amount = parseFloat(e.target.value);
                const confirmBtn = document.getElementById('confirmPaymentBtn');
                const goalRemaining = document.getElementById('payGoalRemaining');
                
                if (confirmBtn && goalRemaining) {
                    const remainingText = goalRemaining.textContent;
                    const remainingAmount = parseFloat(remainingText.replace(/[^\d.-]/g, ''));
                    
                    if (amount > remainingAmount) {
                        confirmBtn.disabled = true;
                        confirmBtn.title = `Сумма не может превышать ${remainingAmount.toFixed(2)} ₽`;
                    } else if (amount <= 0) {
                        confirmBtn.disabled = true;
                        confirmBtn.title = 'Сумма должна быть больше 0';
                    } else {
                        confirmBtn.disabled = false;
                        confirmBtn.title = '';
                    }
                }
            }
        });

        // Кнопка удаления транзакции в модальном окне
        const deleteTransactionBtn = document.getElementById('deleteTransactionBtn');
        if (deleteTransactionBtn) {
            deleteTransactionBtn.addEventListener('click', function() {
                const transactionId = document.getElementById('transactionId').value;
                if (transactionId) {
                    deleteTransaction(parseInt(transactionId));
                    closeAllModals();
                }
            });
        }

        // Изменение типа транзакции
        const transactionType = document.getElementById('transactionType');
        if (transactionType) {
            transactionType.addEventListener('change', updateTransactionCategories);
        }

        // Изменение типа счета (обработчик будет добавлен в openAccountModal)

        // Обработчики для пошаговой навигации
        const nextStepBtn = document.getElementById('nextStepBtn');
        const prevStepBtn = document.getElementById('prevStepBtn');
        
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', nextStep);
        }
        
        if (prevStepBtn) {
            prevStepBtn.addEventListener('click', prevStep);
        }

        // Автоматическое заполнение названия при выборе банка (обработчик будет добавлен в openAccountModal)

        // Изменение категории транзакции
        const transactionCategory = document.getElementById('transactionCategory');
        if (transactionCategory) {
            transactionCategory.addEventListener('change', updateGoalSelection);
        }

        // Делегирование событий для кнопок редактирования/удаления
        document.addEventListener('click', function(e) {
            // Транзакции (иконка редактирования)
            if (e.target.closest('.transaction-edit-icon')) {
                const transactionId = parseInt(e.target.closest('.transaction-edit-icon').dataset.id);
                editTransaction(transactionId);
            }
            
            // Цели
            if (e.target.closest('.edit-goal')) {
                const goalId = parseInt(e.target.closest('.edit-goal').dataset.id);
                editGoal(goalId);
            }
            


            if (e.target.closest('.pay-goal')) {
                const goalId = parseInt(e.target.closest('.pay-goal').dataset.id);
                const target = parseFloat(e.target.closest('.pay-goal').dataset.target);
                const current = parseFloat(e.target.closest('.pay-goal').dataset.current);
                payGoal(goalId, target, current);
            }
            
            // Счета
            if (e.target.closest('.edit-account')) {
                const accountId = parseInt(e.target.closest('.edit-account').dataset.id);
                editAccount(accountId);
            }
        });



        // Заполнение категорий при загрузке
        updateTransactionCategories();

        // Обработка изменения типов графиков
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('chart-type-btn')) {
                const chartType = e.target.dataset.type;
                const chartName = e.target.dataset.chart;
                
                // Убираем активный класс у всех кнопок этого графика
                const chartControls = e.target.closest('.chart-controls');
                chartControls.querySelectorAll('.chart-type-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Добавляем активный класс текущей кнопке
                e.target.classList.add('active');
                
                // Обновляем график
                updateChartType(chartName, chartType);
            }
        });

        // Обработка переключения табов целей
        document.addEventListener('click', function(e) {
            if (e.target.closest('.goal-tab')) {
                const goalTab = e.target.closest('.goal-tab');
                const tabType = goalTab.dataset.goalTab;
                
                // Убираем активный класс у всех табов
                document.querySelectorAll('.goal-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                
                // Скрываем все контенты
                document.querySelectorAll('.goal-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Добавляем активный класс текущему табу
                goalTab.classList.add('active');
                
                // Показываем соответствующий контент
                const targetContent = document.getElementById(`${tabType}GoalsContent`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Показываем заглушки при необходимости после переключения таба
                setTimeout(() => {
                    showPlaceholdersIfNeeded();
                }, 100);
            }
        });

        // Инициализация индикатора активного таба
        const activeTab = document.querySelector('.tab-item.active');
        if (activeTab) {
            updateTabIndicator(activeTab);
        }

        // Обновление индикатора при изменении размера окна
        window.addEventListener('resize', function() {
            const currentActiveTab = document.querySelector('.tab-item.active');
            if (currentActiveTab) {
                updateTabIndicator(currentActiveTab);
            }
        });



        // Обработка кликов по кликабельным статистическим карточкам
        document.addEventListener('click', function(e) {
            if (e.target.closest('.clickable-stat')) {
                const statCard = e.target.closest('.clickable-stat');
                const targetTab = statCard.dataset.tab;
                const goalTab = statCard.dataset.goalTab;
                
                if (targetTab) {
                    // Переключаемся на нужный таб
                    const targetTabButton = document.querySelector(`[data-tab="${targetTab}"]`);
                    if (targetTabButton) {
                        // Убираем активный класс у всех табов
                        document.querySelectorAll('.tab-item').forEach(tab => {
                            tab.classList.remove('active');
                        });
                        
                        // Скрываем все контенты табов
                        document.querySelectorAll('.tab-content').forEach(content => {
                            content.classList.remove('active');
                        });
                        
                        // Активируем нужный таб
                        targetTabButton.classList.add('active');
                        const targetContent = document.getElementById(`${targetTab}-tab`);
                        if (targetContent) {
                            targetContent.classList.add('active');
                        }
                        
                        // Обновляем индикатор активного таба
                        updateTabIndicator(targetTabButton);
                        
                        // Если это таб целей, активируем соответствующий подтаб
                        if (targetTab === 'goals' && goalTab) {
                            // Убираем активный класс у всех табов целей
                            document.querySelectorAll('.goal-tab').forEach(tab => {
                                tab.classList.remove('active');
                            });
                            
                            // Скрываем все контенты целей
                            document.querySelectorAll('.goal-tab-content').forEach(content => {
                                content.classList.remove('active');
                            });
                            
                            // Активируем соответствующий таб целей
                            const targetGoalTab = document.querySelector(`[data-goal-tab="${goalTab}"]`);
                            const targetGoalsContent = document.getElementById(`${goalTab}GoalsContent`);
                            
                            if (targetGoalTab && targetGoalsContent) {
                                targetGoalTab.classList.add('active');
                                targetGoalsContent.classList.add('active');
                                
                                // Добавляем небольшую анимацию для лучшего UX
                                targetGoalsContent.style.animation = 'none';
                                targetGoalsContent.offsetHeight; // Trigger reflow
                                targetGoalsContent.style.animation = 'fadeIn 0.3s ease';
                                
                                // Показываем заглушки при необходимости
                                setTimeout(() => {
                                    showPlaceholdersIfNeeded();
                                }, 100);
                            }
                        }
                        
                        // Плавная прокрутка к табу
                        targetTabButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        // Небольшая задержка для лучшего UX при переключении табов целей
                        if (targetTab === 'goals' && goalTab) {
                            setTimeout(() => {
                                // Дополнительная прокрутка к контенту целей
                                const goalsContent = document.getElementById('goals-tab');
                                if (goalsContent) {
                                    goalsContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                                
                                // Показываем заглушки при необходимости
                                setTimeout(() => {
                                    showPlaceholdersIfNeeded();
                                }, 100);
                            }, 300);
                        }
                    }
                }
            }
        });

        // Обработчик изменения счета в модальном окне расходов
        const expenseAccountSelect = document.getElementById('expenseAccount');
        if (expenseAccountSelect) {
            expenseAccountSelect.addEventListener('change', function() {
                // Обновляем отображение баланса при смене счета
                updateExpenseAccountBalance();
            });
        }

        // Обработчик изменения категории в модальном окне расходов
        const expenseCategorySelect = document.getElementById('expenseCategory');
        if (expenseCategorySelect) {
            expenseCategorySelect.addEventListener('change', function() {
                const selectedCategoryId = this.value;
                const goalSelectionGroup = document.getElementById('expenseGoalSelectionGroup');
                const expenseGoalSelect = document.getElementById('expenseGoal');
                
                if (selectedCategoryId === 'goals') {
                    // Показываем селектор целей
                    goalSelectionGroup.style.display = 'block';
                    populateExpenseGoals();
                } else {
                    // Скрываем селектор целей и сбрасываем выбранную цель
                    goalSelectionGroup.style.display = 'none';
                    if (expenseGoalSelect) {
                        expenseGoalSelect.value = '';
                    }
                }
            });
        }
    }



    // Открытие модального окна дохода
    function openIncomeModal() {
        const modal = document.getElementById('incomeModal');
        const form = document.getElementById('incomeForm');
        
        if (!modal || !form) return;
        
        // Сброс формы
        form.reset();
        document.getElementById('incomeId').value = '';
        
        // Установка текущей даты
        document.getElementById('incomeDate').value = new Date().toISOString().split('T')[0];
        
        // Сброс заголовка модального окна
        const incomeModalTitle = document.querySelector('#incomeModal .modal-header h2');
        if (incomeModalTitle) {
            incomeModalTitle.textContent = 'Добавить доход';
        }
        
        // Скрываем кнопку удаления
        const incomeDeleteBtn = document.getElementById('incomeDeleteBtn');
        if (incomeDeleteBtn) {
            incomeDeleteBtn.style.display = 'none';
        }
        
        // Сброс к первому шагу
        showIncomeStep(1);
        
        // Показать модальное окно с анимацией
        modal.style.display = 'block';
        
        // Блокируем прокрутку страницы
        disablePageScroll();
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        // Заполнение категорий доходов
        populateIncomeCategories();
        
        // Заполнение счетов
        populateIncomeAccounts();
        
        // Обновляем отображение счетов
        updateBalance();
    }

    // Открытие модального окна расхода
    function openExpenseModal() {
        const modal = document.getElementById('expenseModal');
        const form = document.getElementById('expenseForm');
        
        if (!modal || !form) return;
        
        // Сброс формы
        form.reset();
        document.getElementById('expenseId').value = '';
        
        // Установка текущей даты
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
        
        // Сброс заголовка модального окна
        const expenseModalTitle = document.querySelector('#expenseModal .modal-header h2');
        if (expenseModalTitle) {
            expenseModalTitle.textContent = 'Добавить расход';
        }
        
        // Скрываем кнопку удаления
        const expenseDeleteBtn = document.getElementById('expenseDeleteBtn');
        if (expenseDeleteBtn) {
            expenseDeleteBtn.style.display = 'none';
        }
        
        // Сброс к первому шагу
        showExpenseStep(1);
        
        // Показать модальное окно с анимацией
        modal.style.display = 'block';
        
        // Блокируем прокрутку страницы
        disablePageScroll();
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        // Заполнение категорий расходов
        populateExpenseCategories();
        
        // Заполнение счетов
        populateExpenseAccounts();
        
        // Скрываем селектор целей при открытии
        const goalSelectionGroup = document.getElementById('expenseGoalSelectionGroup');
        if (goalSelectionGroup) {
            goalSelectionGroup.style.display = 'none';
        }
        
        // Обновляем отображение счетов
        updateBalance();
    }

    // Показать определенный шаг для дохода
    function showIncomeStep(stepNumber, direction = 'forward') {
        const currentActiveStep = document.querySelector('#incomeModal .form-step.active');
        const targetStep = document.getElementById(`incomeStep${stepNumber}`);
        
        if (!targetStep) {
            return;
        }

        // Анимация перехода
        if (currentActiveStep) {
            currentActiveStep.classList.add(direction === 'forward' ? 'slide-out-left' : 'slide-out-right');
            setTimeout(() => {
                currentActiveStep.classList.remove('active', 'slide-out-left', 'slide-out-right');
                targetStep.classList.add('active');
            }, 300);
        } else {
            targetStep.classList.add('active');
        }

        // Обновление индикатора прогресса
        updateIncomeStepIndicator(stepNumber);
        
        // Обновление кнопок навигации
        updateIncomeNavigationButtons(stepNumber);
    }

    // Показать определенный шаг для расхода
    function showExpenseStep(stepNumber, direction = 'forward') {
        const currentActiveStep = document.querySelector('#expenseModal .form-step.active');
        const targetStep = document.getElementById(`expenseStep${stepNumber}`);
        
        if (!targetStep) return;

        // Анимация перехода
        if (currentActiveStep) {
            currentActiveStep.classList.add(direction === 'forward' ? 'slide-out-left' : 'slide-out-right');
            setTimeout(() => {
                currentActiveStep.classList.remove('active', 'slide-out-left', 'slide-out-right');
                targetStep.classList.add('active');
            }, 300);
        } else {
            targetStep.classList.add('active');
        }

        // Обновление индикатора прогресса
        updateExpenseStepIndicator(stepNumber);
        
        // Обновление кнопок навигации
        updateExpenseNavigationButtons(stepNumber);
        
        // Обновление отображения баланса для шага 3
        if (stepNumber === 3) {
            updateExpenseAccountBalance();
        }
    }

    // Обновление индикатора прогресса для дохода
    function updateIncomeStepIndicator(stepNumber) {
        const steps = document.querySelectorAll('#incomeModal .step');
        steps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index + 1 < stepNumber) {
                step.classList.add('completed');
            } else if (index + 1 === stepNumber) {
                step.classList.add('active');
            }
        });
    }

    // Обновление индикатора прогресса для расхода
    function updateExpenseStepIndicator(stepNumber) {
        const steps = document.querySelectorAll('#expenseModal .step');
        steps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index + 1 < stepNumber) {
                step.classList.add('completed');
            } else if (index + 1 === stepNumber) {
                step.classList.add('active');
            }
        });
    }

    // Обновление кнопок навигации для дохода
    function updateIncomeNavigationButtons(stepNumber) {
        const prevBtn = document.getElementById('incomePrevBtn');
        const nextBtn = document.getElementById('incomeNextBtn');
        const submitBtn = document.getElementById('incomeSubmitBtn');
        
        if (stepNumber === 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        } else if (stepNumber === 3) {
            prevBtn.style.display = 'inline-flex';
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-flex';
        } else {
            prevBtn.style.display = 'inline-flex';
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        }
    }

    // Обновление кнопок навигации для расхода
    function updateExpenseNavigationButtons(stepNumber) {
        const prevBtn = document.getElementById('expensePrevBtn');
        const nextBtn = document.getElementById('expenseNextBtn');
        const submitBtn = document.getElementById('expenseSubmitBtn');
        
        if (stepNumber === 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        } else if (stepNumber === 2) {
            prevBtn.style.display = 'inline-flex';
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        } else if (stepNumber === 3) {
            prevBtn.style.display = 'inline-flex';
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-flex';
        } else {
            prevBtn.style.display = 'inline-flex';
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        }
    }

    // Получить текущий шаг для дохода
    function getCurrentIncomeStep() {
        const activeStep = document.querySelector('#incomeModal .form-step.active');
        if (activeStep) {
            return parseInt(activeStep.id.replace('incomeStep', ''));
        }
        return 1;
    }

    // Обновление отображения баланса счета для расхода
    function updateExpenseAccountBalance() {
        const accountSelect = document.getElementById('expenseAccount');
        const balanceInfo = document.getElementById('expenseAccountBalance');
        
        if (accountSelect && balanceInfo) {
            const selectedAccountId = accountSelect.value;
            if (selectedAccountId) {
                const account = accounts.find(a => a.id === parseInt(selectedAccountId));
                if (account) {
                    balanceInfo.textContent = `Доступно: ${account.balance.toFixed(2)} ₽`;
                    balanceInfo.style.color = account.balance > 0 ? 'var(--text-secondary)' : 'var(--danger)';
                }
            } else {
                balanceInfo.textContent = '';
            }
        }
    }

    // Получить текущий шаг для расхода
    function getCurrentExpenseStep() {
        const activeStep = document.querySelector('#expenseModal .form-step.active');
        if (activeStep) {
            return parseInt(activeStep.id.replace('expenseStep', ''));
        }
        return 1;
    }

    // Валидация шага для дохода
    function validateIncomeStep(stepNumber) {
        switch (stepNumber) {
            case 1:
                const amount = document.getElementById('incomeAmount').value;
                if (!amount || parseFloat(amount) <= 0) {
                    alert('Пожалуйста, введите корректную сумму');
                    return false;
                }
                return true;
            case 2:
                const category = document.getElementById('incomeCategory').value;
                if (!category) {
                    alert('Пожалуйста, выберите категорию');
                    return false;
                }
                return true;
            case 3:
                const account = document.getElementById('incomeAccount').value;
                if (!account) {
                    alert('Пожалуйста, выберите счет');
                    return false;
                }
                return true;
            default:
                return true;
        }
    }

    // Валидация шага для расхода
    function validateExpenseStep(stepNumber) {
        switch (stepNumber) {
            case 1:
                const category = document.getElementById('expenseCategory').value;
                if (!category) {
                    alert('Пожалуйста, выберите категорию');
                    return false;
                }
                
                // Если выбрана категория "Цели", проверяем, что выбрана цель
                if (category === 'goals') {
                    const goal = document.getElementById('expenseGoal').value;
                    if (!goal) {
                        alert('Пожалуйста, выберите цель');
                        return false;
                    }
                }
                return true;
            case 2:
                const account = document.getElementById('expenseAccount').value;
                if (!account) {
                    alert('Пожалуйста, выберите счет');
                    return false;
                }
                return true;
            case 3:
                const amount = document.getElementById('expenseAmount').value;
                if (!amount || parseFloat(amount) <= 0) {
                    alert('Пожалуйста, введите корректную сумму');
                    return false;
                }
                
                // Проверка баланса счета
                const accountId = document.getElementById('expenseAccount').value;
                if (accountId) {
                    const account = accounts.find(a => a.id === parseInt(accountId));
                    if (account && account.balance < parseFloat(amount)) {
                        alert(`Недостаточно средств на счете "${account.name}". Доступно: ${account.balance.toFixed(2)} ₽`);
                        return false;
                    }
                }
                
                // Проверка превышения суммы при оплате цели убрана из валидации
                // Эта проверка выполняется в handleExpenseSubmit для избежания дублирования алертов
                return true;
            default:
                return true;
        }
    }

    // Флаг для предотвращения повторного вызова доходов
    let isIncomeSubmitting = false;
    
    // Массив для отслеживания последних добавленных доходов
    let lastIncomeIds = [];
    
    // Глобальные ссылки на обработчики для правильного удаления
    let incomeSubmitHandler = null;
    let expenseSubmitHandler = null;

    // Обработка отправки формы дохода
    function handleIncomeSubmit() {
        console.log('handleIncomeSubmit вызвана');
        // Предотвращаем повторный вызов
        if (isIncomeSubmitting) {
            console.log('handleIncomeSubmit уже выполняется, пропускаем');
            return;
        }
        isIncomeSubmitting = true;
        
        // Дополнительная защита - проверяем, не была ли функция вызвана недавно
        const now = Date.now();
        if (handleIncomeSubmit.lastCall && (now - handleIncomeSubmit.lastCall) < 1000) {
            console.log('handleIncomeSubmit вызвана слишком быстро, пропускаем');
            isIncomeSubmitting = false;
            return;
        }
        handleIncomeSubmit.lastCall = now;
        
        // Проверяем валидацию всех шагов перед обработкой
        if (!validateIncomeStep(1) || !validateIncomeStep(2) || !validateIncomeStep(3)) {
            isIncomeSubmitting = false;
            return;
        }
        
        const formData = {
            id: document.getElementById('incomeId').value || null,
            type: 'income',
            amount: parseFloat(document.getElementById('incomeAmount').value),
            category: document.getElementById('incomeCategory').value,
            date: document.getElementById('incomeDate').value,
            description: document.getElementById('incomeDescription').value || '',
            accountId: parseInt(document.getElementById('incomeAccount').value)
        };

        // Валидация
        if (!formData.amount || !formData.category || !formData.date || !formData.accountId) {
            alert('Пожалуйста, заполните все обязательные поля');
            isIncomeSubmitting = false;
            return;
        }

        // Добавляем транзакцию
        if (formData.id) {
            // Редактирование существующей транзакции
            const index = transactions.findIndex(t => t.id === parseInt(formData.id));
            if (index !== -1) {
                const oldTransaction = transactions[index];
                
                // Возвращаем старую сумму к балансу счета
                const oldAccount = accounts.find(a => a.id === oldTransaction.accountId);
                if (oldAccount) {
                    oldAccount.balance -= oldTransaction.amount;
                }
                
                // Обновляем транзакцию
                transactions[index] = { ...transactions[index], ...formData };
            }
        } else {
            // Добавление новой транзакции
            const newTransaction = {
                ...formData,
                id: generateId(transactions)
            };
            
            // Проверяем, нет ли уже транзакции с таким ID
            const existingTransaction = transactions.find(t => t.id === newTransaction.id);
            if (!existingTransaction && !lastIncomeIds.includes(newTransaction.id)) {
                console.log(`Добавляем доход: ID=${newTransaction.id}, тип=${newTransaction.type}, сумма=${newTransaction.amount}`);
                transactions.push(newTransaction);
                
                // Добавляем ID в массив отслеживания
                lastIncomeIds.push(newTransaction.id);
                
                // Ограничиваем массив последними 10 доходами
                if (lastIncomeIds.length > 10) {
                    lastIncomeIds = lastIncomeIds.slice(-10);
                }
            } else {
                console.log(`Доход с ID=${newTransaction.id} уже существует или дублируется, пропускаем`);
            }
        }

        // Обновляем баланс счета
        const account = accounts.find(a => a.id === formData.accountId);
        if (account) {
            account.balance += formData.amount;
        }

        // Сохраняем данные
        updateLocalStorage();
        
        // Обновляем интерфейс
        renderTransactions();
        renderAccounts();
        updateDashboard();
        
        // Закрыть модальное окно
        closeAllModals();
        
        // Уведомление об успехе убрано
        
        // Сбрасываем флаг после завершения обработки
        isIncomeSubmitting = false;
    }

    // Флаг для предотвращения повторного вызова
    let isExpenseSubmitting = false;
    
    // Массив для отслеживания последних добавленных расходов
    let lastExpenseIds = [];

    // Обработка отправки формы расхода
    function handleExpenseSubmit() {
        console.log('handleExpenseSubmit вызвана');
        // Предотвращаем повторный вызов
        if (isExpenseSubmitting) {
            console.log('handleExpenseSubmit уже выполняется, пропускаем');
            return;
        }
        isExpenseSubmitting = true;
        
        // Дополнительная защита - проверяем, не была ли функция вызвана недавно
        const now = Date.now();
        if (handleExpenseSubmit.lastCall && (now - handleExpenseSubmit.lastCall) < 1000) {
            console.log('handleExpenseSubmit вызвана слишком быстро, пропускаем');
            isExpenseSubmitting = false;
            return;
        }
        handleExpenseSubmit.lastCall = now;
        
        // Проверяем валидацию всех шагов перед обработкой
        if (!validateExpenseStep(1) || !validateExpenseStep(2) || !validateExpenseStep(3)) {
            isExpenseSubmitting = false;
            return;
        }
        
        const formData = {
            id: document.getElementById('expenseId').value || null,
            type: 'expense',
            amount: parseFloat(document.getElementById('expenseAmount').value),
            category: document.getElementById('expenseCategory').value,
            date: document.getElementById('expenseDate').value,
            description: document.getElementById('expenseDescription').value || '',
            accountId: parseInt(document.getElementById('expenseAccount').value),
            goalId: document.getElementById('expenseGoal').value || null
        };

        // Если выбрана категория "Цели", но не выбрана цель, очищаем goalId
        if (formData.category === 'goals' && !formData.goalId) {
            formData.goalId = null;
        }

        // Валидация
        if (!formData.amount || !formData.category || !formData.date || !formData.accountId) {
            alert('Пожалуйста, заполните все обязательные поля');
            isExpenseSubmitting = false;
            return;
        }

        // Проверка баланса счета
        const account = accounts.find(a => a.id === formData.accountId);
        if (account && account.balance < formData.amount) {
            alert(`Недостаточно средств на счете "${account.name}". Доступно: ${account.balance.toFixed(2)} ₽`);
            isExpenseSubmitting = false;
            return;
        }

        // Проверка превышения суммы при оплате цели
        if (formData.category === 'goals' && formData.goalId) {
            const goal = goals.find(g => g.id === parseInt(formData.goalId));
            if (goal) {
                // Убеждаемся, что goal.current не превышает goal.target
                if (goal.current > goal.target) {
                    goal.current = goal.target;
                }
                
                const remainingAmount = Math.max(0, goal.target - goal.current);
                
                if (formData.amount > remainingAmount) {
                    alert(`Сумма оплаты (${formData.amount.toFixed(2)} ₽) превышает оставшуюся часть цели (${remainingAmount.toFixed(2)} ₽). Максимальная сумма к оплате: ${remainingAmount.toFixed(2)} ₽`);
                    isExpenseSubmitting = false;
                    return;
                }
            }
        }

        // Добавляем транзакцию
        if (formData.id) {
            // Редактирование существующей транзакции
            const index = transactions.findIndex(t => t.id === parseInt(formData.id));
            if (index !== -1) {
                const oldTransaction = transactions[index];
                
                // Возвращаем старую сумму к балансу счета
                const oldAccount = accounts.find(a => a.id === oldTransaction.accountId);
                if (oldAccount) {
                    oldAccount.balance += oldTransaction.amount; // Возвращаем расход
                }
                
                // Отменяем старую цель, если была
                if (oldTransaction.goalId) {
                    const oldGoal = goals.find(g => g.id === parseInt(oldTransaction.goalId));
                    if (oldGoal) {
                        oldGoal.current -= oldTransaction.amount;
                        // Убеждаемся, что не уходим в минус
                        if (oldGoal.current < 0) {
                            oldGoal.current = 0;
                        }
                    }
                }
                
                // Очищаем goalId если категория не "goals"
                if (formData.category !== 'goals') {
                    formData.goalId = null;
                }
                
                // Обновляем транзакцию
                transactions[index] = { ...transactions[index], ...formData };
            }
        } else {
            // Добавление новой транзакции
            const newTransaction = {
                ...formData,
                id: generateId(transactions)
            };
            
            // Проверяем, нет ли уже транзакции с таким ID
            const existingTransaction = transactions.find(t => t.id === newTransaction.id);
            if (!existingTransaction && !lastExpenseIds.includes(newTransaction.id)) {
                console.log(`Добавляем расход: ID=${newTransaction.id}, тип=${newTransaction.type}, сумма=${newTransaction.amount}`);
                transactions.push(newTransaction);
                
                // Добавляем ID в массив отслеживания
                lastExpenseIds.push(newTransaction.id);
                
                // Ограничиваем массив последними 10 расходами
                if (lastExpenseIds.length > 10) {
                    lastExpenseIds = lastExpenseIds.slice(-10);
                }
            } else {
                console.log(`Расход с ID=${newTransaction.id} уже существует или дублируется, пропускаем`);
            }
        }

        // Обновляем баланс счета
        if (account) {
            account.balance -= formData.amount;
        }

        // Обновляем цель, если указана
        if (formData.goalId) {
            const goal = goals.find(g => g.id === parseInt(formData.goalId));
            if (goal) {
                goal.current += formData.amount;
                // Убеждаемся, что не превышаем целевую сумму
                if (goal.current > goal.target) {
                    goal.current = goal.target;
                }
            }
        }

        // Сохраняем данные
        updateLocalStorage();
        
        // Обновляем интерфейс
        renderTransactions();
        renderAccounts();
        renderGoals();
        updateDashboard();
        
        // Закрыть модальное окно
        closeAllModals();
        
        // Показать уведомление об успехе
        if (formData.goalId) {
            const goal = goals.find(g => g.id === parseInt(formData.goalId));
            if (goal) {
                if (goal.current >= goal.target) {
                    alert(`🎉 Поздравляем! Цель "${goal.name}" успешно достигнута!`);
                } else {
                    const progress = ((goal.current / goal.target) * 100).toFixed(1);
                    alert(`✅ Успешно оплачено ${formData.amount.toFixed(2)} ₽ для цели "${goal.name}". Прогресс: ${progress}%`);
                }
            }
        } else {
            // Уведомление об успехе убрано
        }
        
        // Сбрасываем флаг после завершения обработки
        isExpenseSubmitting = false;
    }

    // Заполнение категорий доходов
    function populateIncomeCategories() {
        const categorySelect = document.getElementById('incomeCategory');
        if (!categorySelect) {
            console.log('incomeCategory select not found');
            return;
        }
        
        if (!categories || !categories.income) {
            console.log('categories.income not found');
            return;
        }
        
        categorySelect.innerHTML = '';
        categories.income.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = `${category.icon} ${category.name}`;
            categorySelect.appendChild(option);
        });
    }

    // Заполнение категорий расходов
    function populateExpenseCategories() {
        const categorySelect = document.getElementById('expenseCategory');
        if (!categorySelect) {
            console.log('expenseCategory select not found');
            return;
        }
        
        if (!categories || !categories.expense) {
            console.log('categories.expense not found');
            return;
        }
        
        categorySelect.innerHTML = '';
        categories.expense.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = `${category.icon} ${category.name}`;
            categorySelect.appendChild(option);
        });
    }

    // Заполнение целей для расходов
    function populateExpenseGoals() {
        const goalSelect = document.getElementById('expenseGoal');
        if (!goalSelect) {
            console.log('expenseGoal select not found');
            return;
        }
        
        if (!goals || goals.length === 0) {
            console.log('No goals found');
            return;
        }
        
        goalSelect.innerHTML = '<option value="">Выберите цель</option>';
        
        // Показываем только активные цели (не завершенные)
        const activeGoals = goals.filter(goal => goal.current < goal.target);
        
        activeGoals.forEach(goal => {
            const option = document.createElement('option');
            option.value = goal.id;
            const name = goal.name || 'Без названия';
            option.textContent = name;
            goalSelect.appendChild(option);
        });
    }

    // Заполнение счетов для дохода
    function populateIncomeAccounts() {
        const accountSelect = document.getElementById('incomeAccount');
        if (!accountSelect) {
            console.log('incomeAccount select not found');
            return;
        }
        
        if (!accounts || accounts.length === 0) {
            return;
        }
        
        accountSelect.innerHTML = '';
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.name} (${account.balance.toFixed(2)} ₽)`;
            accountSelect.appendChild(option);
        });
    }

    // Заполнение счетов для расхода
    function populateExpenseAccounts() {
        const accountSelect = document.getElementById('expenseAccount');
        if (!accountSelect) {
            console.log('expenseAccount select not found');
            return;
        }
        
        if (!accounts || accounts.length === 0) {
            return;
        }
        
        accountSelect.innerHTML = '';
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.name} (${account.balance.toFixed(2)} ₽)`;
            accountSelect.appendChild(option);
        });
    }

    // Обновление категорий в зависимости от типа транзакции
    // При открытии модального окна цели скрыты по умолчанию
    function updateTransactionCategories() {
        const typeSelect = document.getElementById('transactionType');
        const categorySelect = document.getElementById('transactionCategory');
        const goalSelectionGroup = document.getElementById('goalSelectionGroup');
        const goalSelect = document.getElementById('transactionGoal');
        
        if (!typeSelect || !categorySelect || !goalSelectionGroup || !goalSelect) return;
        
        const type = typeSelect.value;
        
        // Очистка
        categorySelect.innerHTML = '';
        goalSelect.innerHTML = '<option value="">Выберите цель</option>';
        
        // Добавление категорий
        categories[type].forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = `${category.icon} ${category.name}`;
            categorySelect.appendChild(option);
        });
        
        // Показываем/скрываем поле выбора цели только для расходов
        if (type === 'expense') {
            // Скрываем группу выбора цели по умолчанию
            goalSelectionGroup.classList.remove('show');
            goalSelectionGroup.classList.add('hide');
            
            // Очищаем поле цели
            goalSelect.value = '';
        } else {
            goalSelectionGroup.classList.remove('show');
            goalSelectionGroup.classList.add('hide');
            // Очищаем поле цели при смене типа на доход
            if (goalSelect) {
                goalSelect.value = '';
            }
        }
    }

    // Функция для управления отображением целей в зависимости от выбранной категории
    // Цели показываются только когда выбран тип "Расход" и категория "Цели" (🎯)
    function updateGoalSelection() {
        const categorySelect = document.getElementById('transactionCategory');
        const goalSelectionGroup = document.getElementById('goalSelectionGroup');
        const goalSelect = document.getElementById('transactionGoal');
        const typeSelect = document.getElementById('transactionType');
        
        if (!categorySelect || !goalSelectionGroup || !goalSelect || !typeSelect) return;
        
        const selectedCategory = categorySelect.value;
        const type = typeSelect.value;
        
        // Показываем цели только для расходов и только когда выбрана категория "Цели"
        if (type === 'expense' && selectedCategory === 'goals') {
            goalSelectionGroup.classList.remove('hide');
            goalSelectionGroup.classList.add('show');
            
            // Полностью очищаем список целей перед заполнением
            goalSelect.innerHTML = '<option value="">Выберите цель</option>';
            
            // Получаем только активные цели (не завершенные)
            const activeGoals = goals.filter(goal => {
                const progress = (goal.current / goal.target) * 100;
                const deadline = new Date(goal.deadline);
                const now = new Date();
                return progress < 100 && deadline >= now;
            });
            
            // Заполняем список только активными целями
            activeGoals.forEach(goal => {
                const option = document.createElement('option');
                option.value = goal.id;
                option.textContent = `${goal.name} (${goal.current.toFixed(2)}/${goal.target.toFixed(2)} ₽)`;

                goalSelect.appendChild(option);
            });
        } else {
            goalSelectionGroup.classList.remove('show');
            goalSelectionGroup.classList.add('hide');
            // Очищаем поле цели
            goalSelect.value = '';
        }
    }

    // Открытие модального окна цели
    function openGoalModal() {
        const modal = document.getElementById('goalModal');
        const form = document.getElementById('goalForm');
        const modalTitle = document.getElementById('goalModalTitle');
        const deleteBtn = document.getElementById('deleteGoalBtn');
        
        if (!modal || !form || !modalTitle || !deleteBtn) return;
        
        // Сброс формы
        form.reset();
        document.getElementById('goalId').value = '';
        
        // Установка текущей даты + 1 месяц по умолчанию
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        document.getElementById('goalDeadline').value = nextMonth.toISOString().split('T')[0];
        
        // Обновляем заголовок и скрываем кнопку удаления
        modalTitle.textContent = 'Добавить цель';
        deleteBtn.style.display = 'none';
        
        // Показать модальное окно с анимацией
        modal.style.display = 'flex';
        
        // Блокируем прокрутку страницы
        disablePageScroll();
        
        // Запускаем анимацию открытия
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    // Открытие модального окна счета
    function openAccountModal(accountId = null) {
        const modal = document.getElementById('accountModal');
        const form = document.getElementById('accountForm');
        const modalTitle = document.getElementById('accountModalTitle');
        const deleteBtn = document.getElementById('deleteAccountBtn');
        
        if (!modal || !form || !modalTitle || !deleteBtn) {
            return;
        }
        
        // Сброс формы
        form.reset();
        document.getElementById('accountId').value = '';
        
        // Сброс переменной для банка
        selectedBankName = '';
        
        if (accountId) {
            // Режим редактирования
            const account = accounts.find(a => a.id === parseInt(accountId));
            if (account) {
                modalTitle.textContent = 'Редактировать счет';
                document.getElementById('accountId').value = account.id;
                document.getElementById('accountName').value = account.name;
                document.getElementById('accountType').value = account.type;
                document.getElementById('accountBalance').value = account.balance;
                document.getElementById('accountCurrency').value = account.currency;
                document.getElementById('accountBank').value = account.bank || '';
                
                // Устанавливаем название банка для редактирования
                if (account.bank) {
                    const accountBank = document.getElementById('accountBank');
                    const selectedOption = accountBank.options[accountBank.selectedIndex];
                    selectedBankName = selectedOption ? selectedOption.text : '';
                }
                
                // Обновляем видимость поля банка
                updateBankFieldVisibility();
            }
        } else {
            // Режим добавления
            modalTitle.textContent = 'Добавить счет';
            deleteBtn.style.display = 'none';
        }
        
        // Показать модальное окно с анимацией
        modal.style.display = 'flex';
        
        // Блокируем прокрутку страницы
        disablePageScroll();
        
        // Запускаем анимацию открытия
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
        
        // Инициализация пошаговой формы
        initStepForm();
        
        // Добавляем обработчики событий для автоматического заполнения
        setTimeout(() => {
            setupAccountFormHandlers();
        }, 100);
    }

    // Настройка обработчиков для формы счета
    function setupAccountFormHandlers() {
        // Изменение типа счета
        const accountType = document.getElementById('accountType');
        if (accountType) {
            // Удаляем старые обработчики
            accountType.removeEventListener('change', handleAccountTypeChange);
            // Добавляем новый обработчик
            accountType.addEventListener('change', handleAccountTypeChange);
        }

        // Изменение банка
        const accountBank = document.getElementById('accountBank');
        if (accountBank) {
            // Удаляем старые обработчики
            accountBank.removeEventListener('change', handleAccountBankChange);
            // Добавляем новый обработчик
            accountBank.addEventListener('change', handleAccountBankChange);
            console.log('Обработчик для accountBank добавлен');
        }
    }

    // Обработчик изменения типа счета
    function handleAccountTypeChange() {
        console.log('Тип счета изменен на:', this.value);
        updateBankFieldVisibility();
        // Не вызываем autoFillAccountName здесь, только при переходе к шагу 3
    }

    // Обработчик изменения банка
    function handleAccountBankChange() {
        console.log('Банк изменен на:', this.value);
        
        // Сохраняем название банка
        if (this.value) {
            const selectedOption = this.options[this.selectedIndex];
            selectedBankName = selectedOption.text;
            console.log('Сохранено название банка:', selectedBankName);
        } else {
            selectedBankName = '';
        }
        
        // Не вызываем autoFillAccountName здесь, только при переходе к шагу 3
    }

    // Функция для управления видимостью поля банка
    function updateBankFieldVisibility() {
        const accountType = document.getElementById('accountType');
        const bankSelectionGroup = document.getElementById('bankSelectionGroup');
        
        if (!accountType || !bankSelectionGroup) return;
        
        // Показываем поле банка только для не-наличных счетов
        if (accountType.value === 'cash') {
            bankSelectionGroup.style.display = 'none';
        } else {
            bankSelectionGroup.style.display = 'block';
        }
    }

    // Инициализация пошаговой формы
    function initStepForm() {
        const accountId = document.getElementById('accountId').value;
        const accountType = document.getElementById('accountType').value;
        
        // При редактировании показываем все данные сразу
        if (accountId) {
            showStep(3);
            updateStepButtons(3);
            updateStepIndicators(3);
        } else {
            // При добавлении начинаем с первого шага
            showStep(1);
            updateStepButtons(1);
            updateStepIndicators(1);
        }
    }

    // Показать определенный шаг
    function showStep(stepNumber, direction = 'forward') {
        const accountModal = document.getElementById('accountModal');
        if (!accountModal) return;
        
        const currentActiveStep = accountModal.querySelector('.form-step.active');
        const targetStep = document.getElementById(`step${stepNumber}`);
        
        if (!targetStep) return;

        // Определяем направление анимации
        const isForward = direction === 'forward';
        const slideOutClass = isForward ? 'slide-out-left' : 'slide-out-right';
        const slideInDirection = isForward ? 'slideInFromRight' : 'slideInFromLeft';

        // Если есть активный шаг, анимируем его скрытие
        if (currentActiveStep && currentActiveStep !== targetStep) {
            currentActiveStep.classList.add(slideOutClass);
            
            setTimeout(() => {
                currentActiveStep.classList.remove('active', slideOutClass);
                currentActiveStep.style.display = 'none';
                
                // Показываем новый шаг
                targetStep.style.display = 'block';
                targetStep.classList.add('active');
                
                // Обновить индикаторы шагов
                updateStepIndicators(stepNumber);
                
                // Если переходим к шагу 3, очищаем и заполняем название автоматически
                if (stepNumber === 3) {
                    setTimeout(() => {
                        const accountName = document.getElementById('accountName');
                        if (accountName) {
                            accountName.value = ''; // Очищаем поле названия
                        }
                        autoFillAccountName(); // Заполняем заново
                    }, 200);
                }
            }, 300);
        } else {
            // Если нет активного шага, просто показываем новый
            targetStep.style.display = 'block';
            targetStep.classList.add('active');
            updateStepIndicators(stepNumber);
            
            // Если переходим к шагу 3, очищаем и заполняем название автоматически
            if (stepNumber === 3) {
                setTimeout(() => {
                    const accountName = document.getElementById('accountName');
                    if (accountName) {
                        accountName.value = ''; // Очищаем поле названия
                    }
                    autoFillAccountName(); // Заполняем заново
                }, 200);
            }
        }
    }

    // Обновить индикаторы шагов
    function updateStepIndicators(currentStep) {
        const accountModal = document.getElementById('accountModal');
        if (!accountModal) return;
        
        const steps = accountModal.querySelectorAll('.step');
        steps.forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.remove('active', 'completed');
            
            if (stepNumber === currentStep) {
                step.classList.add('active');
            } else if (stepNumber < currentStep) {
                step.classList.add('completed');
            }
        });
    }

    // Обновить кнопки навигации
    function updateStepButtons(currentStep) {
        const prevBtn = document.getElementById('prevStepBtn');
        const nextBtn = document.getElementById('nextStepBtn');
        const saveBtn = document.getElementById('saveAccountBtn');
        const deleteBtn = document.getElementById('deleteAccountBtn');
        const accountType = document.getElementById('accountType');
        const accountId = document.getElementById('accountId');

        // Скрыть все кнопки
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';

        // Показать кнопку удаления только при редактировании
        if (deleteBtn) {
            deleteBtn.style.display = accountId && accountId.value ? 'inline-flex' : 'none';
        }

        if (currentStep === 1) {
            // Первый шаг - только "Далее"
            if (nextBtn) {
                nextBtn.style.display = 'inline-flex';
                nextBtn.style.visibility = 'visible';
                nextBtn.style.opacity = '1';
                nextBtn.removeAttribute('style');
                nextBtn.style.display = 'inline-flex';
            }
        } else if (currentStep === 2) {
            // Второй шаг - "Назад" и "Далее" (если не наличные)
            if (prevBtn) prevBtn.style.display = 'inline-flex';
            if (accountType && accountType.value !== 'cash' && nextBtn) {
                nextBtn.style.display = 'inline-flex';
            } else if (saveBtn) {
                saveBtn.style.display = 'inline-flex';
            }
        } else if (currentStep === 3) {
            // Третий шаг - "Назад" и "Сохранить"
            if (prevBtn) prevBtn.style.display = 'inline-flex';
            if (saveBtn) saveBtn.style.display = 'inline-flex';
        }
    }

    // Переход к следующему шагу
    function nextStep() {
        const currentStep = getCurrentStep();
        const accountType = document.getElementById('accountType');

        if (currentStep === 1) {
            if (!accountType.value) {
                alert('Пожалуйста, выберите тип счета');
                return;
            }
            
            if (accountType.value === 'cash') {
                // Для наличных пропускаем шаг 2
                showStep(3, 'forward');
                updateStepButtons(3);
            } else {
                showStep(2, 'forward');
                updateStepButtons(2);
            }
        } else if (currentStep === 2) {
            const accountBank = document.getElementById('accountBank');
            if (!accountBank.value) {
                alert('Пожалуйста, выберите банк');
                return;
            }
            showStep(3, 'forward');
            updateStepButtons(3);
        }
    }

    // Переход к предыдущему шагу
    function prevStep() {
        const currentStep = getCurrentStep();
        const accountType = document.getElementById('accountType');

        if (currentStep === 2) {
            showStep(1, 'backward');
            updateStepButtons(1);
        } else if (currentStep === 3) {
            if (accountType && accountType.value === 'cash') {
                showStep(1, 'backward');
                updateStepButtons(1);
            } else {
                showStep(2, 'backward');
                updateStepButtons(2);
            }
        }
    }

    // Переменная для хранения выбранного банка
    let selectedBankName = '';

    // Автоматическое заполнение названия счета при выборе банка
    window.autoFillAccountName = function() {
        const accountType = document.getElementById('accountType');
        const accountBank = document.getElementById('accountBank');
        const accountName = document.getElementById('accountName');
        
        console.log('autoFillAccountName вызвана');
        console.log('accountType:', accountType?.value);
        console.log('accountBank value:', accountBank?.value);
        console.log('accountName текущее значение:', accountName?.value);
        
        if (!accountType || !accountName) {
            console.log('accountType или accountName не найден');
            return;
        }
        
        const typeNames = {
            'cash': 'Наличные',
            'card': 'Банковская карта',
            'credit': 'Кредитная карта',
            'savings': 'Сберегательный счет',
            'investment': 'Инвестиционный счет'
        };
        
        const typeName = typeNames[accountType.value] || 'Счет';
        console.log('Тип счета:', typeName);
        
        // Получаем название банка напрямую из селектора
        let bankName = '';
        if (accountBank && accountBank.value && accountType.value !== 'cash') {
            const selectedOption = accountBank.options[accountBank.selectedIndex];
            if (selectedOption) {
                bankName = selectedOption.text;
                console.log('Получено название банка из селектора:', bankName);
            }
        }
        
        // Заполняем название только если поле пустое И есть выбранные значения
        if (!accountName.value.trim() && accountType.value && (accountType.value === 'cash' || bankName)) {
            if (bankName) {
                const newName = `${bankName} - ${typeName}`;
                accountName.value = newName;
                console.log('Установлено новое название с банком:', newName);
            } else if (accountType.value === 'cash') {
                accountName.value = typeName;
                console.log('Установлено название для наличных:', typeName);
            }
        } else {
            console.log('Поле названия уже заполнено или нет выбранных значений, пропускаем');
        }
    };

    // Получить текущий шаг
    function getCurrentStep() {
        const accountModal = document.getElementById('accountModal');
        if (!accountModal) return 1;
        
        const activeStep = accountModal.querySelector('.form-step.active');
        if (activeStep) {
            return parseInt(activeStep.id.replace('step', ''));
        }
        return 1;
    }

    // Функции для управления прокруткой страницы
    function disablePageScroll() {
        // Сохраняем текущую позицию прокрутки
        const scrollY = window.scrollY;
        document.body.classList.add('modal-open');
        // Устанавливаем позицию body для предотвращения прокрутки
        document.body.style.top = `-${scrollY}px`;
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
    }

    function enablePageScroll() {
        // Восстанавливаем позицию прокрутки
        const scrollY = document.body.style.top;
        document.body.classList.remove('modal-open');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        if (scrollY) {
            // Плавно возвращаемся к сохраненной позиции
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
    }

    // Закрытие всех модальных окон
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.classList.contains('show')) {
                // Запускаем анимацию закрытия вниз
                modal.classList.add('closing');
                
                // Ждем завершения анимации и скрываем модальное окно
                setTimeout(() => {
                    modal.style.display = 'none';
                    // Убираем классы
                    modal.classList.remove('show', 'closing');
                }, 400); // Время анимации
            } else {
                modal.style.display = 'none';
            }
        });
        
        // Очищаем состояние кнопки с остатком цели
        const remainingAmountBtns = document.querySelectorAll('.payment-hint-remaining');
        remainingAmountBtns.forEach(btn => {
            btn.classList.remove('success');
        });
        
        // Скрываем цели в модальном окне транзакций при закрытии
        const goalSelectionGroup = document.getElementById('goalSelectionGroup');
        if (goalSelectionGroup) {
            goalSelectionGroup.classList.remove('show');
            goalSelectionGroup.classList.add('hide');
        }
        
        // Очищаем поле выбора цели
        const goalSelect = document.getElementById('transactionGoal');
        if (goalSelect) {
            goalSelect.value = '';
        }
        
        // Восстанавливаем прокрутку страницы
        enablePageScroll();
    }

    // Открытие модального окна перевода
    function openTransferModal() {
        const modal = document.getElementById('transferModal');
        const form = document.getElementById('transferForm');
        
        // Очищаем форму
        form.reset();
        
        // Заполняем списки счетов
        populateTransferAccounts();
        
        // Скрываем дополнительные элементы
        document.getElementById('fromAccountBalance').style.display = 'none';
        document.getElementById('transferSummary').style.display = 'none';
        
        // Показываем модальное окно
        modal.style.display = 'block';
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        // Блокируем прокрутку страницы
        disablePageScroll();
    }

    // Заполнение списков счетов в модальном окне перевода
    function populateTransferAccounts() {
        const fromSelect = document.getElementById('transferFromAccount');
        const toSelect = document.getElementById('transferToAccount');
        
        // Очищаем списки
        fromSelect.innerHTML = '<option value="">Выберите счет</option>';
        toSelect.innerHTML = '<option value="">Выберите счет</option>';
        
        // Добавляем счета
        accounts.forEach(account => {
            const option1 = document.createElement('option');
            option1.value = account.id;
            option1.textContent = `${account.name} (${account.balance.toFixed(2)} ₽)`;
            fromSelect.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = account.id;
            option2.textContent = `${account.name} (${account.balance.toFixed(2)} ₽)`;
            toSelect.appendChild(option2);
        });
    }

    // Обработка изменения счета списания
    function handleFromAccountChange() {
        const fromAccountId = document.getElementById('transferFromAccount').value;
        const balanceInfo = document.getElementById('fromAccountBalance');
        const balanceAmount = document.getElementById('fromAccountBalanceAmount');
        
        if (fromAccountId) {
            const account = accounts.find(acc => acc.id == fromAccountId);
            if (account) {
                balanceAmount.textContent = `${account.balance.toFixed(2)} ₽`;
                balanceInfo.style.display = 'flex';
            }
        } else {
            balanceInfo.style.display = 'none';
        }
        
        updateTransferSummary();
    }

    // Обновление сводки перевода
    function updateTransferSummary() {
        const fromAccountId = document.getElementById('transferFromAccount').value;
        const toAccountId = document.getElementById('transferToAccount').value;
        const amount = parseFloat(document.getElementById('transferAmount').value) || 0;
        const summary = document.getElementById('transferSummary');
        const feeElement = document.getElementById('transferFee');
        const totalElement = document.getElementById('transferTotal');
        
        if (fromAccountId && toAccountId && amount > 0) {
            // Комиссия 0% (можно изменить)
            const fee = 0;
            const total = amount + fee;
            
            feeElement.textContent = `${fee.toFixed(2)} ₽`;
            totalElement.textContent = `${total.toFixed(2)} ₽`;
            
            summary.style.display = 'block';
        } else {
            summary.style.display = 'none';
        }
    }

    // Обработка быстрого выбора суммы
    function setTransferAmount(amount) {
        document.getElementById('transferAmount').value = amount;
        updateTransferSummary();
    }

    // Флаг для предотвращения повторного вызова транзакций
    let isTransactionSubmitting = false;
    
    // Массив для отслеживания последних добавленных транзакций
    let lastTransactionIds = [];

    // Обработка отправки формы транзакции
    function handleTransactionSubmit(e) {
        e.preventDefault();
        console.log('handleTransactionSubmit вызвана');
        
        // Предотвращаем повторный вызов
        if (isTransactionSubmitting) {
            console.log('handleTransactionSubmit уже выполняется, пропускаем');
            return;
        }
        isTransactionSubmitting = true;
        
        const transactionId = document.getElementById('transactionId');
        const transactionType = document.getElementById('transactionType');
        const transactionAmount = document.getElementById('transactionAmount');
        const transactionCategory = document.getElementById('transactionCategory');
        const transactionDate = document.getElementById('transactionDate');
        const transactionDescription = document.getElementById('transactionDescription');
        const transactionAccount = document.getElementById('transactionAccount');
        
        if (!transactionId || !transactionType || !transactionAmount || !transactionCategory || 
            !transactionDate || !transactionDescription || !transactionAccount) {
            isTransactionSubmitting = false;
            return;
        }
        

        
        const transactionGoal = document.getElementById('transactionGoal');
        
        const formData = {
            id: transactionId.value ? parseInt(transactionId.value) : generateId(transactions),
            type: transactionType.value,
            amount: parseFloat(transactionAmount.value),
            category: transactionCategory.value,
            date: transactionDate.value,
            description: transactionDescription.value || 'Без описания',
            accountId: parseInt(transactionAccount.value),
            goalId: transactionGoal ? transactionGoal.value : null
        };
        
        // Проверяем, не добавляли ли мы уже эту транзакцию недавно
        if (lastTransactionIds.includes(formData.id)) {
            console.log('Дублирование транзакции предотвращено:', formData.id);
            isTransactionSubmitting = false;
            return;
        }
        
        // Поиск существующей транзакции
        const existingIndex = transactions.findIndex(t => t.id === formData.id);
        
        if (existingIndex >= 0) {
            // Обновление существующей транзакции
            const oldTransaction = transactions[existingIndex];
            
            // Возвращаем старые средства на счет
            const oldAccount = accounts.find(a => a.id === oldTransaction.accountId);
            if (oldAccount) {
                if (oldTransaction.type === 'income') {
                    oldAccount.balance -= oldTransaction.amount;
                } else {
                    oldAccount.balance += oldTransaction.amount;
                }
            }
            
                    // Обрабатываем возврат средств для старой цели, если она была
        if (oldTransaction.goalId && oldTransaction.type === 'expense') {
            const oldGoal = goals.find(g => g.id === oldTransaction.goalId);
            if (oldGoal) {
                oldGoal.current -= oldTransaction.amount;
                if (oldGoal.current < 0) oldGoal.current = 0;
            }
        }
        
        // Если тип изменился с расхода на доход, и была связана цель, убираем связь
        if (oldTransaction.goalId && oldTransaction.type === 'expense' && formData.type === 'income') {
            formData.goalId = null;
        }
        
        // Если тип изменился с расхода на доход, и была связана цель, убираем связь
        if (oldTransaction.goalId && oldTransaction.type === 'expense' && formData.type === 'income') {
            formData.goalId = null;
        }
        
        // Если тип изменился с дохода на расход, и была связана цель, убираем связь
        if (oldTransaction.goalId && oldTransaction.type === 'income' && formData.type === 'expense') {
            formData.goalId = null;
        }
        
        // Если сумма изменилась в транзакции, связанной с целью, корректируем цель
        if (oldTransaction.goalId && oldTransaction.type === 'expense' && formData.type === 'expense' && 
            oldTransaction.goalId === formData.goalId && oldTransaction.amount !== formData.amount) {
            const goal = goals.find(g => g.id === oldTransaction.goalId);
            if (goal) {
                // Возвращаем старую сумму
                goal.current -= oldTransaction.amount;
                if (goal.current < 0) goal.current = 0;
                
                // Проверяем превышение цели для новой суммы
                const remainingAmount = Math.max(0, goal.target - goal.current);
                if (formData.amount > remainingAmount) {
                    formData.amount = remainingAmount;
                }
                
                // Добавляем новую сумму
                goal.current += formData.amount;
                if (goal.current > goal.target) goal.current = goal.target;
                
                // Обновляем описание транзакции, если цель была указана
                if (formData.description === 'Без описания' || formData.description === '') {
                    formData.description = `Оплата цели: ${goal.name}`;
                }
            }
        }
        
        // Если в транзакции добавилась новая цель (раньше цели не было)
        if (!oldTransaction.goalId && formData.goalId && formData.type === 'expense') {
            const newGoal = goals.find(g => g.id === parseInt(formData.goalId));
            if (newGoal) {
                // Проверяем превышение цели
                const remainingAmount = newGoal.target - newGoal.current;
                if (formData.amount > remainingAmount) {
                    formData.amount = remainingAmount;
                }
                
                newGoal.current += formData.amount;
                if (newGoal.current > newGoal.target) newGoal.current = newGoal.target;
                
                // Обновляем описание транзакции, если цель была указана
                if (formData.description === 'Без описания' || formData.description === '') {
                    formData.description = `Оплата цели: ${newGoal.name}`;
                }
            }
        }
        
        // Если цель изменилась в транзакции, корректируем обе цели
        if (oldTransaction.goalId && oldTransaction.type === 'expense' && formData.type === 'expense' && 
            oldTransaction.goalId !== formData.goalId) {
            // Возвращаем средства старой цели
            const oldGoal = goals.find(g => g.id === oldTransaction.goalId);
            if (oldGoal) {
                oldGoal.current -= oldTransaction.amount;
                if (oldGoal.current < 0) oldGoal.current = 0;
            }
            
            // Добавляем средства новой цели
            if (formData.goalId) {
                const newGoal = goals.find(g => g.id === parseInt(formData.goalId));
                if (newGoal) {
                    // Проверяем превышение цели для новой цели
                    const remainingAmount = newGoal.target - newGoal.current;
                    if (formData.amount > remainingAmount) {
                        formData.amount = remainingAmount;
                    }
                    
                    newGoal.current += formData.amount;
                    if (newGoal.current > newGoal.target) newGoal.current = newGoal.target;
                    
                    // Обновляем описание транзакции, если цель была указана
                    if (formData.description === 'Без описания' || formData.description === '') {
                        formData.description = `Оплата цели: ${newGoal.name}`;
                    }
                }
            }
        }
            
            // Обновляем транзакцию
            transactions[existingIndex] = formData;
            
            // Применяем новые изменения к счету
            const newAccount = accounts.find(a => a.id === formData.accountId);
            if (newAccount) {
                if (formData.type === 'income') {
                    newAccount.balance += formData.amount;
                } else {
                    // Проверяем баланс для расходов
                    if (newAccount.balance < formData.amount) {
                        alert(`Недостаточно средств на счете "${newAccount.name}". Доступно: ${newAccount.balance.toFixed(2)} ${newAccount.currency}, необходимо: ${formData.amount.toFixed(2)} ${newAccount.currency}`);
                        isTransactionSubmitting = false;
                        return;
                    }
                    newAccount.balance -= formData.amount;
                }
            }
            

                } else {
            // Проверка баланса для новых расходов
            if (formData.type === 'expense') {
                const account = accounts.find(a => a.id === formData.accountId);
                if (!account) {
                    alert('Счет не найден!');
                    isTransactionSubmitting = false;
                    return;
                }
                
                if (account.balance < formData.amount) {
                    alert(`Недостаточно средств на счете "${account.name}". Доступно: ${account.balance.toFixed(2)} ${account.currency}, необходимо: ${formData.amount.toFixed(2)} ${account.currency}`);
                    isTransactionSubmitting = false;
                    return;
                }
                
                // Обработка оплаты цели, если транзакция связана с целью (для новых транзакций)
                if (formData.goalId) {
                    const goal = goals.find(g => g.id === parseInt(formData.goalId));
                    if (goal) {
                        // Убеждаемся, что goal.current не превышает goal.target
                        if (goal.current > goal.target) {
                            goal.current = goal.target;
                        }
                        
                        const remainingAmount = Math.max(0, goal.target - goal.current);
                        if (formData.amount > remainingAmount) {
                            alert(`Сумма расхода (${formData.amount.toFixed(2)} ₽) превышает оставшуюся часть цели "${goal.name}" (${remainingAmount.toFixed(2)} ₽). Максимальная сумма к оплате: ${remainingAmount.toFixed(2)} ₽`);
                            isTransactionSubmitting = false;
                            return;
                        }
                        
                        // Обновляем цель
                        goal.current += formData.amount;
                        
                        // Проверяем, достигнута ли цель
                        if (goal.current >= goal.target) {
                            goal.current = goal.target; // Убеждаемся, что не превышаем цель
                        }
                        
                        // Обновляем описание транзакции, если цель была указана
                        if (formData.description === 'Без описания' || formData.description === '') {
                            formData.description = `Оплата цели: ${goal.name}`;
                        }
                    }
                }
            }
            
            // Добавление новой транзакции
            // Проверяем, нет ли уже транзакции с таким ID
            const existingTransaction = transactions.find(t => t.id === formData.id);
            if (!existingTransaction) {
                console.log(`Добавляем транзакцию: ID=${formData.id}, тип=${formData.type}, сумма=${formData.amount}`);
                transactions.push(formData);
            } else {
                console.log(`Транзакция с ID=${formData.id} уже существует, пропускаем`);
            }
            
            // Обновление баланса счета
            const account = accounts.find(a => a.id === formData.accountId);
            if (account) {
                if (formData.type === 'income') {
                    account.balance += formData.amount;
                } else {
                    account.balance -= formData.amount;
                }
            }
        }
        

        

        
        // Обновление приложения
        updateLocalStorage();
        renderAccounts(); // Обновляем отображение счетов
        renderGoals(); // Обновляем отображение целей
        renderTransactions(); // Обновляем отображение транзакций
        updateDashboard();
        closeAllModals();
        
        // Уведомление об успешной оплате цели
        if (formData.goalId && formData.type === 'expense') {
            const goal = goals.find(g => g.id === parseInt(formData.goalId));
            if (goal) {
                if (goal.current >= goal.target) {
                    alert(`🎉 Поздравляем! Цель "${goal.name}" успешно достигнута!`);
                } else {
                    const progress = ((goal.current / goal.target) * 100).toFixed(1);
                    alert(`✅ Успешно оплачено ${formData.amount.toFixed(2)} ₽ для цели "${goal.name}". Прогресс: ${progress}%`);
                }
            }
        }
        
        // Анимация успеха
        const button = e.target.querySelector('button[type="submit"]');
        if (button) {
            button.classList.add('pulse');
            setTimeout(() => button.classList.remove('pulse'), 600);
        }
        
        // Добавляем ID транзакции в массив отслеживания
        lastTransactionIds.push(formData.id);
        
        // Ограничиваем массив последними 10 транзакциями
        if (lastTransactionIds.length > 10) {
            lastTransactionIds = lastTransactionIds.slice(-10);
        }
        
        // Сбрасываем флаг после завершения обработки
        isTransactionSubmitting = false;
    }

    // Обработка отправки формы категории
    function handleCategorySubmit(e) {
        e.preventDefault();
        
        const categoryId = document.getElementById('categoryId');
        const categoryName = document.getElementById('categoryName');
        const categoryIcon = document.getElementById('categoryIcon');
        const categoryTypeSelect = document.getElementById('categoryTypeSelect');
        
        if (!categoryId || !categoryName || !categoryIcon || !categoryTypeSelect) return;
        
        const type = categoryTypeSelect.value;
        
        const formData = {
            id: categoryId.value || generateCategoryId(type),
            name: categoryName.value,
            icon: categoryIcon.value
        };
        
        // Поиск существующей категории
        const existingIndex = categories[type].findIndex(c => c.id === formData.id);
        
        if (existingIndex >= 0) {
            // Обновление существующей категории
            categories[type][existingIndex] = formData;
        } else {
            // Добавление новой категории
            categories[type].push(formData);
        }
        
        // Обновление приложения
        updateLocalStorage();
        loadCategoriesSettings();
        renderTransactions();
        updateDashboard();
        closeAllModals();
        
        // Анимация успеха
        const button = e.target.querySelector('button[type="submit"]');
        if (button) {
            button.classList.add('pulse');
            setTimeout(() => button.classList.remove('pulse'), 600);
        }
    }

    // Обработка отправки формы цели
    function handleGoalSubmit(e) {
        e.preventDefault();
        
        const goalId = document.getElementById('goalId');
        const goalName = document.getElementById('goalName');
        const goalTarget = document.getElementById('goalTarget');
        const goalCurrent = document.getElementById('goalCurrent');
        const goalDeadline = document.getElementById('goalDeadline');
        
        if (!goalId || !goalName || !goalTarget || !goalCurrent || !goalDeadline) return;
        
        const formData = {
            id: goalId.value ? parseInt(goalId.value) : generateId(goals),
            name: goalName.value,
            target: parseFloat(goalTarget.value),
            current: parseFloat(goalCurrent.value),
            deadline: goalDeadline.value
        };
        
        // Валидация
        if (formData.current > formData.target) {
            alert('Текущая сумма не может превышать целевую!');
            goalCurrent.classList.add('shake');
            setTimeout(() => goalCurrent.classList.remove('shake'), 600);
            return;
        }
        
        // Поиск существующей цели
        const existingIndex = goals.findIndex(g => g.id === formData.id);
        
        if (existingIndex >= 0) {
            // Обновление существующей цели - сохраняем текущий прогресс
            const existingGoal = goals[existingIndex];
            goals[existingIndex] = {
                ...formData,
                current: existingGoal.current // Сохраняем текущий прогресс, достигнутый через транзакции
            };
        } else {
            // Добавление новой цели
            goals.push(formData);
        }
        
        // Обновление приложения
        updateLocalStorage();
        renderGoals();
        updateDashboard();
        
        // Показываем заглушки при необходимости после изменения цели
        showPlaceholdersIfNeeded();
        
        closeAllModals();
        
        // Анимация успеха
        const button = e.target.querySelector('button[type="submit"]');
        if (button) {
            button.classList.add('pulse');
            setTimeout(() => button.classList.remove('pulse'), 600);
        }
    }

    // Обработка отправки формы счета
    function handleAccountSubmit(e) {
        e.preventDefault();
        
        const accountId = document.getElementById('accountId');
        const accountName = document.getElementById('accountName');
        const accountType = document.getElementById('accountType');
        const accountBalance = document.getElementById('accountBalance');
        const accountCurrency = document.getElementById('accountCurrency');
        const accountBank = document.getElementById('accountBank');
        
        if (!accountId || !accountName || !accountType || !accountBalance || !accountCurrency) return;
        
        // Автоматическое заполнение названия банка
        let bankName = '';
        if (accountBank && accountBank.value) {
            const selectedOption = accountBank.options[accountBank.selectedIndex];
            bankName = selectedOption.text;
        }

        const formData = {
            id: accountId.value ? parseInt(accountId.value) : generateId(accounts),
            name: accountName.value,
            type: accountType.value,
            balance: parseFloat(accountBalance.value),
            currency: accountCurrency.value,
            bank: accountBank ? accountBank.value : '',
            bankName: bankName
        };
        
        // Поиск существующего счета
        const existingIndex = accounts.findIndex(a => a.id === formData.id);
        
        if (existingIndex >= 0) {
            // Обновление существующего счета
            accounts[existingIndex] = formData;
        } else {
            // Добавление нового счета
            accounts.push(formData);
        }
        
        // Обновление приложения
        updateLocalStorage();
        renderAccounts();
        updateDashboard();
        closeAllModals();
        
        // Анимация успеха
        const button = e.target.querySelector('button[type="submit"]');
        if (button) {
            button.classList.add('pulse');
            setTimeout(() => button.classList.remove('pulse'), 600);
        }
    }

    // Удаление счета
    function deleteAccount(accountId) {
        if (!confirm('Вы уверены, что хотите удалить этот счет? Все связанные транзакции также будут удалены.')) return;
        
        // Проверяем, есть ли связанные транзакции
        const relatedTransactions = transactions.filter(t => t.accountId === parseInt(accountId));
        
        if (relatedTransactions.length > 0) {
            if (!confirm(`Найдено ${relatedTransactions.length} связанных транзакций. Они также будут удалены. Продолжить?`)) return;
            
            // Удаляем связанные транзакции
            transactions = transactions.filter(t => t.accountId !== parseInt(accountId));
        }
        
        // Удаляем счет
        const accountIndex = accounts.findIndex(a => a.id === parseInt(accountId));
        if (accountIndex === -1) return;
        
        accounts.splice(accountIndex, 1);
        
        // Если удаляемый счет был текущим, выбираем первый доступный
        if (currentAccountId === parseInt(accountId)) {
            currentAccountId = accounts.length > 0 ? accounts[0].id : null;
        }
        
        // Обновление приложения
        updateLocalStorage();
        renderAccounts();
        renderTransactions(); // Обновляем транзакции (с фильтрацией несуществующих счетов)
        updateDashboard();
        
        // Обновляем фильтры (убираем удаленный счет из фильтра)
        initFilters();
        
        // Закрываем модальное окно
        closeAllModals();
        
        // Показываем уведомление об успехе
        alert('Счет успешно удален');
    }



    // Редактирование транзакции
    function editTransaction(id) {
        let transaction = transactions.find(t => t.id === id);
        if (!transaction) {
            // Попробуем найти по строковому ID
            transaction = transactions.find(t => t.id === id.toString());
        }
        if (!transaction) {
            // Попробуем найти по числовому ID
            transaction = transactions.find(t => parseInt(t.id) === id);
        }
        if (!transaction) {
            console.log('Transaction not found with id:', id);
            return;
        }
        
        // Определяем, какая форма нужна (доход или расход)
        if (transaction.type === 'income') {
            // Заполняем категории доходов
            populateIncomeCategories();
            populateIncomeAccounts();
            
            // Изменяем заголовок модального окна
            const incomeModalTitle = document.querySelector('#incomeModal .modal-header h2');
            if (incomeModalTitle) {
                incomeModalTitle.textContent = 'Редактировать доход';
            }
            
            // Показываем кнопку удаления
            const incomeDeleteBtn = document.getElementById('incomeDeleteBtn');
            if (incomeDeleteBtn) {
                incomeDeleteBtn.style.display = 'inline-flex';
            }
            
            // Заполняем форму дохода с небольшой задержкой
            setTimeout(() => {
                const incomeId = document.getElementById('incomeId');
                const incomeAmount = document.getElementById('incomeAmount');
                const incomeCategory = document.getElementById('incomeCategory');
                const incomeDate = document.getElementById('incomeDate');
                const incomeDescription = document.getElementById('incomeDescription');
                const incomeAccount = document.getElementById('incomeAccount');
                
                if (incomeId) incomeId.value = transaction.id;
                if (incomeAmount) incomeAmount.value = transaction.amount;
                if (incomeCategory) incomeCategory.value = transaction.category;
                if (incomeDate) incomeDate.value = transaction.date;
                if (incomeDescription) incomeDescription.value = transaction.description;
                if (incomeAccount) incomeAccount.value = transaction.accountId;
            }, 50);
            
            // Открываем модальное окно дохода
            const incomeModal = document.getElementById('incomeModal');
            if (incomeModal) {
                incomeModal.style.display = 'flex';
                incomeModal.style.zIndex = '9999';
                incomeModal.style.visibility = 'visible';
                incomeModal.style.opacity = '1';
                incomeModal.classList.add('show');
                // Сбрасываем к первому шагу с небольшой задержкой
                setTimeout(() => {
                    showIncomeStep(1);
                    
                    // Проверяем, что модальное окно действительно видно
                    const modalContent = incomeModal.querySelector('.modal-content');
                    if (modalContent) {
                        modalContent.style.visibility = 'visible';
                        modalContent.style.opacity = '1';
                        modalContent.classList.add('show');
                    }
                }, 100);
            }
        } else {
            // Заполняем категории расходов
            populateExpenseCategories();
            populateExpenseAccounts();
            populateExpenseGoals();
            
            // Изменяем заголовок модального окна
            const expenseModalTitle = document.querySelector('#expenseModal .modal-header h2');
            if (expenseModalTitle) {
                expenseModalTitle.textContent = 'Редактировать расход';
            }
            
            // Показываем кнопку удаления
            const expenseDeleteBtn = document.getElementById('expenseDeleteBtn');
            if (expenseDeleteBtn) {
                expenseDeleteBtn.style.display = 'inline-flex';
            }
            
            // Заполняем форму расхода с небольшой задержкой
            setTimeout(() => {
                const expenseId = document.getElementById('expenseId');
                const expenseAmount = document.getElementById('expenseAmount');
                const expenseCategory = document.getElementById('expenseCategory');
                const expenseDate = document.getElementById('expenseDate');
                const expenseDescription = document.getElementById('expenseDescription');
                const expenseAccount = document.getElementById('expenseAccount');
                const expenseGoal = document.getElementById('expenseGoal');
                
                if (expenseId) expenseId.value = transaction.id;
                if (expenseAmount) expenseAmount.value = transaction.amount;
                if (expenseCategory) expenseCategory.value = transaction.category;
                if (expenseDate) expenseDate.value = transaction.date;
                if (expenseDescription) expenseDescription.value = transaction.description;
                if (expenseAccount) expenseAccount.value = transaction.accountId;
                if (transaction.goalId && expenseGoal) {
                    expenseGoal.value = transaction.goalId;
                }
            }, 50);
            
            // Открываем модальное окно расхода
            const expenseModal = document.getElementById('expenseModal');
            if (expenseModal) {
                expenseModal.style.display = 'flex';
                expenseModal.style.zIndex = '9999';
                expenseModal.style.visibility = 'visible';
                expenseModal.style.opacity = '1';
                expenseModal.classList.add('show');
                // Сбрасываем к первому шагу с небольшой задержкой
                setTimeout(() => {
                    showExpenseStep(1);
                }, 100);
            }
        }
    }

    // Удаление транзакции
    function deleteTransaction(id) {
        if (!confirm('Вы уверены, что хотите удалить эту транзакцию?')) return;
        
        const transactionIndex = transactions.findIndex(t => t.id === id);
        if (transactionIndex === -1) return;
        
        const transaction = transactions[transactionIndex];
        
        // Обрабатываем возврат средств для цели, если транзакция была связана с целью
        if (transaction.goalId && transaction.type === 'expense') {
            const goal = goals.find(g => g.id === transaction.goalId);
            if (goal) {
                goal.current -= transaction.amount;
                if (goal.current < 0) goal.current = 0;
            }
        }
        
        // Обновление баланса счета при удалении транзакции
        const account = accounts.find(a => a.id === transaction.accountId);
        if (account) {
            if (transaction.type === 'income') {
                account.balance -= transaction.amount; // Убираем доход
            } else {
                account.balance += transaction.amount; // Возвращаем расход
            }
        }
        
        // Удаление транзакции
        transactions.splice(transactionIndex, 1);
        
        // Обновление приложения
        updateLocalStorage();
        renderAccounts(); // Обновляем отображение счетов
        renderGoals(); // Обновляем отображение целей
        updateDashboard();
        
        // Закрываем модальное окно
        closeAllModals();
    }

    // Редактирование цели
    function editGoal(id) {
        const goal = goals.find(g => g.id === id);
        if (!goal) return;
        
        const modal = document.getElementById('goalModal');
        const form = document.getElementById('goalForm');
        const modalTitle = document.getElementById('goalModalTitle');
        const deleteBtn = document.getElementById('deleteGoalBtn');
        
        if (!modal || !form || !modalTitle || !deleteBtn) return;
        
        // Заполнение формы
        document.getElementById('goalId').value = goal.id;
        document.getElementById('goalName').value = goal.name;
        document.getElementById('goalTarget').value = goal.target;
        document.getElementById('goalCurrent').value = goal.current;
        document.getElementById('goalDeadline').value = goal.deadline;
        
        // Обновляем заголовок и показываем кнопку удаления
        modalTitle.textContent = 'Редактировать цель';
        deleteBtn.style.display = 'inline-flex';
        
        // Показать модальное окно с анимацией
        modal.style.display = 'flex';
        
        // Блокируем прокрутку страницы
        disablePageScroll();
        
        // Запускаем анимацию открытия
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    // Удаление цели
    function deleteGoal(id) {
        if (!confirm('Вы уверены, что хотите удалить эту цель?')) return;
        
        const goalIndex = goals.findIndex(g => g.id === id);
        if (goalIndex === -1) return;
        
        // Удаление цели
        goals.splice(goalIndex, 1);
        
        // Обновление приложения
        updateLocalStorage();
        renderGoals();
        updateDashboard();
        
        // Показываем заглушки при необходимости после удаления цели
        showPlaceholdersIfNeeded();
    }





    // Редактирование категории
    function editCategory(categoryId, type) {
        const category = categories[type].find(c => c.id === categoryId);
        if (!category) return;
        
        const modal = document.getElementById('categoryModal');
        const form = document.getElementById('categoryForm');
        const title = document.getElementById('categoryModalTitle');
        const deleteBtn = document.getElementById('deleteCategoryBtn');
        
        if (!modal || !form || !title || !deleteBtn) return;
        
        // Заполняем форму данными категории
        document.getElementById('categoryId').value = category.id;
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categoryIcon').value = category.icon;
        document.getElementById('categoryType').value = type;
        
        // Устанавливаем тип категории в селекте
        const categoryTypeSelect = document.getElementById('categoryTypeSelect');
        if (categoryTypeSelect) {
            categoryTypeSelect.value = type;
        }
        
        // Устанавливаем заголовок
        title.textContent = 'Редактировать категорию';
        
        // Показываем кнопку удаления
        deleteBtn.style.display = 'inline-flex';
        
        // Показываем модальное окно
        modal.style.display = 'flex';
        
        // Блокируем прокрутку страницы
        disablePageScroll();
        
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    // Удаление категории
    function deleteCategory(categoryId, type) {
        if (!confirm('Вы уверены, что хотите удалить эту категорию?')) return;
        
        const categoryIndex = categories[type].findIndex(c => c.id === categoryId);
        if (categoryIndex === -1) return;
        
        // Удаление категории
        categories[type].splice(categoryIndex, 1);
        
        // Обновление приложения
        updateLocalStorage();
        loadCategoriesSettings();
        renderTransactions();
        updateDashboard();
    }

    // Открытие модального окна для добавления категории
    function openCategoryModal(type = 'expense') {
        const modal = document.getElementById('categoryModal');
        const form = document.getElementById('categoryForm');
        const title = document.getElementById('categoryModalTitle');
        const deleteBtn = document.getElementById('deleteCategoryBtn');
        
        if (!modal || !form || !title || !deleteBtn) return;
        
        // Сброс формы
        form.reset();
        document.getElementById('categoryId').value = '';
        document.getElementById('categoryType').value = type;
        
        // Устанавливаем тип категории в селекте
        const categoryTypeSelect = document.getElementById('categoryTypeSelect');
        if (categoryTypeSelect) {
            categoryTypeSelect.value = type;
        }
        
        // Установка заголовка
        title.textContent = 'Добавить категорию';
        
        // Скрыть кнопку удаления при добавлении новой категории
        deleteBtn.style.display = 'none';
        
        // Показать модальное окно
        modal.style.display = 'flex';
        
        // Блокируем прокрутку страницы
        disablePageScroll();
        
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    // Закрытие модального окна категории
    function closeCategoryModal() {
        const modal = document.getElementById('categoryModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
                // Восстанавливаем прокрутку страницы
                enablePageScroll();
            }, 400);
        }
    }

    // Открытие модального окна оплаты цели
    function openPayGoalModal(goalId) {
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;
        
        const modal = document.getElementById('payGoalModal');
        const goalName = document.getElementById('payGoalName');
        const goalCurrent = document.getElementById('payGoalCurrent');
        const goalTarget = document.getElementById('payGoalTarget');
        const goalRemaining = document.getElementById('payGoalRemaining');
        const goalProgressBar = document.getElementById('payGoalProgressBar');
        const paymentAmount = document.getElementById('paymentAmount');
        const paymentAccount = document.getElementById('paymentAccount');
        const selectedAccountBalance = document.getElementById('selectedAccountBalance');
        
        if (!modal || !goalName || !goalCurrent || !goalTarget || !goalRemaining || 
            !goalProgressBar || !paymentAmount || !paymentAccount || !selectedAccountBalance) return;
        
        // Заполняем информацию о цели
        goalName.textContent = goal.name;
        goalCurrent.textContent = `${goal.current.toFixed(2)} ₽`;
        goalTarget.textContent = `${goal.target.toFixed(2)} ₽`;
        
        const remainingAmount = Math.max(0, goal.target - goal.current);
        goalRemaining.textContent = `${remainingAmount.toFixed(2)} ₽`;
        
        // Обновляем прогресс-бар
        const progress = (goal.current / goal.target) * 100;
        goalProgressBar.style.width = `${progress}%`;
        
        // Заполняем селект счетов
        paymentAccount.innerHTML = '';
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.name} (${account.balance.toFixed(2)} ${account.currency})`;
            paymentAccount.appendChild(option);
        });
        
        // Устанавливаем активный счет по умолчанию
        paymentAccount.value = currentAccountId;
        updateSelectedAccountBalance();
        
        // Добавляем обработчик изменения счета
        paymentAccount.addEventListener('change', updateSelectedAccountBalance);
        
        // Добавляем обработчик изменения суммы для подсветки кнопки с остатком
        paymentAmount.addEventListener('input', function() {
            const amount = parseFloat(this.value) || 0;
            const remainingAmount = Math.max(0, goal.target - goal.current);
            const remainingAmountBtns = document.querySelectorAll('.payment-hint-remaining');
            
            // Ограничиваем ввод максимальной суммой
            if (amount > remainingAmount) {
                this.value = remainingAmount.toFixed(2);
            }
            
            remainingAmountBtns.forEach(btn => {
                if (Math.abs(amount - remainingAmount) < 0.01) {
                    btn.classList.add('success');
                } else {
                    btn.classList.remove('success');
                }
            });
        });
        
        // Устанавливаем максимальную сумму к оплате
        paymentAmount.max = remainingAmount;
        paymentAmount.placeholder = `0.00 - ${remainingAmount.toFixed(2)}`;
        
        // Обновляем состояние кнопок быстрого выбора
        updatePaymentHintButtons(remainingAmount);
        
        // Заполняем кнопку с остатком
        const remainingAmountBtn = document.getElementById('remainingAmountBtn');
        const remainingAmountBtnFirst = document.getElementById('remainingAmountBtnFirst');
        const remainingAmountValue = document.getElementById('remainingAmountValue');
        const remainingAmountValueFirst = document.getElementById('remainingAmountValueFirst');
        
        if (remainingAmountBtn && remainingAmountValue) {
            remainingAmountValue.textContent = `${remainingAmount.toFixed(2)} ₽`;
        }
        if (remainingAmountBtnFirst && remainingAmountValueFirst) {
            remainingAmountValueFirst.textContent = `${remainingAmount.toFixed(2)} ₽`;
        }
        
        // Показываем модальное окно
        modal.style.display = 'flex';
        
        // Блокируем прокрутку страницы
        disablePageScroll();
        
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
        
        // Добавляем обработчики для кнопок с подсказками
        addPaymentHintHandlers();
    }

    // Обновление баланса выбранного счета
    function updateSelectedAccountBalance() {
        const paymentAccount = document.getElementById('paymentAccount');
        const selectedAccountBalance = document.getElementById('selectedAccountBalance');
        
        if (!paymentAccount || !selectedAccountBalance) return;
        
        const selectedAccount = accounts.find(a => a.id === parseInt(paymentAccount.value));
        if (selectedAccount) {
            selectedAccountBalance.textContent = `${selectedAccount.balance.toFixed(2)} ${selectedAccount.currency}`;
        }
    }
    
    // Обновление состояния кнопок быстрого выбора суммы
    function updatePaymentHintButtons(maxAmount) {
        const paymentHintBtns = document.querySelectorAll('.payment-hint-btn:not(.payment-hint-remaining)');
        paymentHintBtns.forEach(btn => {
            const amount = parseFloat(btn.dataset.amount);
            if (amount > maxAmount) {
                // Кнопка превышает максимальную сумму - делаем её неактивной
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                btn.title = `Максимальная сумма: ${maxAmount.toFixed(2)} ₽`;
            } else {
                // Кнопка активна
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.title = '';
            }
        });
    }

    // Добавление обработчиков для кнопок с подсказками
    function addPaymentHintHandlers() {
        // Обработчики для обычных кнопок с суммами
        const paymentHintBtns = document.querySelectorAll('.payment-hint-btn:not(.payment-hint-remaining)');
        paymentHintBtns.forEach(btn => {
            btn.onclick = function() {
                // Проверяем, не заблокирована ли кнопка
                if (this.style.opacity === '0.5') {
                    return; // Кнопка заблокирована
                }
                
                const amount = parseFloat(this.dataset.amount);
                const paymentAmount = document.getElementById('paymentAmount');
                if (paymentAmount) {
                    // Проверяем максимальную сумму
                    const maxAmount = parseFloat(paymentAmount.max);
                    if (maxAmount && amount > maxAmount) {
                        // Если сумма превышает максимальную, устанавливаем максимальную
                        paymentAmount.value = maxAmount.toFixed(2);
                    } else {
                        paymentAmount.value = amount;
                    }
                    // Добавляем визуальную обратную связь
                    paymentAmount.focus();
                    btn.classList.add('pulse');
                    setTimeout(() => btn.classList.remove('pulse'), 600);
                }
            };
            
            // Добавляем обработчики для клавиатуры
            btn.onkeydown = function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.click();
                }
            };
            
            // Делаем кнопку доступной для клавиатуры
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('role', 'button');
            btn.setAttribute('aria-label', `Заполнить сумму ${btn.dataset.amount} ₽`);
        });
        
        // Обработчики для кнопок с остатком цели
        const remainingAmountBtns = document.querySelectorAll('.payment-hint-remaining');
        remainingAmountBtns.forEach(btn => {
            btn.onclick = function() {
                const remainingAmountText = this.querySelector('.remaining-amount-value');
                if (remainingAmountText) {
                    const amount = parseFloat(remainingAmountText.textContent.replace(' ₽', ''));
                    const paymentAmount = document.getElementById('paymentAmount');
                    if (paymentAmount && !isNaN(amount)) {
                        paymentAmount.value = amount;
                        // Добавляем визуальную обратную связь
                        paymentAmount.focus();
                        btn.classList.add('pulse');
                        setTimeout(() => btn.classList.remove('pulse'), 600);
                    }
                }
            };
            
            // Добавляем обработчики для клавиатуры
            btn.onkeydown = function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.click();
                }
            };
            
            // Делаем кнопку доступной для клавиатуры
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('role', 'button');
            btn.setAttribute('aria-label', 'Заполнить остаток цели');
        });
    }

    // Функция для добавления обработчиков кнопок с подсказками иконок категорий
    function addCategoryIconHintHandlers() {
        const iconHintButtons = document.querySelectorAll('.icon-hint-btn');
        iconHintButtons.forEach(button => {
            button.addEventListener('click', function() {
                const icon = this.dataset.icon;
                if (icon) {
                    const categoryIcon = document.getElementById('categoryIcon');
                    if (categoryIcon) {
                        categoryIcon.value = icon;
                    }
                }
            });
        });
    }

    // Оплата цели с баланса (частичная или полная)
    function payGoal(goalId, target, current) {
        // Открываем модальное окно для выбора суммы
        openPayGoalModal(goalId);
    }

    // Подтверждение оплаты цели
    function confirmGoalPayment() {
        const paymentAmount = document.getElementById('paymentAmount');
        const paymentAccount = document.getElementById('paymentAccount');
        
        if (!paymentAmount || !paymentAccount) return;
        
        const amount = parseFloat(paymentAmount.value);
        const accountId = parseInt(paymentAccount.value);
        
        if (!amount || amount <= 0) {
            alert('Пожалуйста, введите корректную сумму для оплаты');
            return;
        }
        
        // Проверяем максимальную сумму из атрибута max
        const maxAmount = parseFloat(paymentAmount.max);
        if (maxAmount && amount > maxAmount) {
            alert(`Сумма оплаты (${amount.toFixed(2)} ₽) превышает максимально допустимую сумму (${maxAmount.toFixed(2)} ₽)`);
            return;
        }
        
        const selectedAccount = accounts.find(a => a.id === accountId);
        if (!selectedAccount) {
            alert('Счет не найден');
            return;
        }
        
        if (selectedAccount.balance < amount) {
            alert(`Недостаточно средств на счете "${selectedAccount.name}". Доступно: ${selectedAccount.balance.toFixed(2)} ${selectedAccount.currency}`);
            return;
        }
        
        // Получаем цель из модального окна
        const goalName = document.getElementById('payGoalName');
        if (!goalName) return;
        
        const goal = goals.find(g => g.name === goalName.textContent);
        if (!goal) {
            alert('Цель не найдена');
            return;
        }
        
        // Проверяем, не достигнута ли уже цель
        if (goal.current >= goal.target) {
            alert('Цель уже достигнута. Дополнительная оплата не требуется.');
            return;
        }
        
        // Проверяем, не превышает ли сумма оставшуюся часть цели
        // Убеждаемся, что goal.current не превышает goal.target
        if (goal.current > goal.target) {
            goal.current = goal.target;
        }
        
        const remainingAmount = Math.max(0, goal.target - goal.current);
        if (remainingAmount <= 0) {
            alert('Цель уже достигнута или превышена. Дополнительная оплата не требуется.');
            return;
        }
        if (amount > remainingAmount) {
            alert(`Сумма оплаты (${amount.toFixed(2)} ₽) превышает оставшуюся часть цели (${remainingAmount.toFixed(2)} ₽). Максимальная сумма к оплате: ${remainingAmount.toFixed(2)} ₽`);
            return;
        }
        
        // Списываем средства со счета
        selectedAccount.balance -= amount;
        
        // Обновляем цель
        goal.current += amount;
        
        // Добавляем транзакцию
        const transaction = {
            id: generateId(transactions),
            type: 'expense',
            amount: amount,
            category: 'other',
            date: new Date().toISOString().split('T')[0],
            description: `Оплата цели: ${goal.name}`,
            accountId: accountId
        };
        
        transactions.push(transaction);
        
        // Обновляем приложение
        updateLocalStorage();
        renderAccounts();
        renderTransactions();
        renderGoals();
        updateDashboard();
        
        // Показываем заглушки при необходимости после оплаты цели
        showPlaceholdersIfNeeded();
        
        // Закрываем модальное окно
        closeAllModals();
        
        // Показываем сообщение об успехе
        if (goal.current >= goal.target) {
            alert(`Поздравляем! Цель "${goal.name}" успешно достигнута!`);
        } else {
            alert(`Успешно оплачено ${amount.toFixed(2)} ₽ для цели "${goal.name}". Прогресс: ${((goal.current / goal.target) * 100).toFixed(1)}%`);
        }
    }

    // Редактирование счета
    function editAccount(id) {
        openAccountModal(id);
    }

    // Удаление счета
    function deleteAccount(id) {
        // Проверка, есть ли транзакции, связанные с этим счетом
        const accountTransactions = transactions.filter(t => t.accountId === id);
        if (accountTransactions.length > 0) {
            if (!confirm(`У этого счета есть ${accountTransactions.length} транзакций. При удалении счета все связанные транзакции также будут удалены. Продолжить?`)) {
                return;
            }
            
            // Удаление связанных транзакций
            transactions = transactions.filter(t => t.accountId !== id);
        }
        
        if (!confirm('Вы уверены, что хотите удалить этот счет?')) return;
        
        const accountIndex = accounts.findIndex(a => a.id === id);
        if (accountIndex === -1) return;
        
        // Удаление счета
        accounts.splice(accountIndex, 1);
        
        // Если удален активный счет, сделать активным первый счет (если он есть)
        if (currentAccountId === id) {
            currentAccountId = accounts.length > 0 ? accounts[0].id : null;
        }
        
        // Обновление приложения
        updateLocalStorage();
        renderAccounts();
        renderTransactions(); // Обновляем транзакции (с фильтрацией несуществующих счетов)
        updateDashboard();
        
        // Обновляем фильтры (убираем удаленный счет из фильтра)
        initFilters();
        
        // Закрываем модальное окно
        closeAllModals();
    }

    // Обработка отправки формы перевода
    function handleTransferSubmit(e) {
        e.preventDefault();
        
        const fromAccountId = parseInt(document.getElementById('transferFromAccount').value);
        const toAccountId = parseInt(document.getElementById('transferToAccount').value);
        const amount = parseFloat(document.getElementById('transferAmount').value);
        const description = 'Перевод между счетами';
        
        // Валидация
        if (!fromAccountId || !toAccountId) {
            alert('Пожалуйста, выберите счета для перевода');
            return;
        }
        
        if (fromAccountId === toAccountId) {
            alert('Нельзя переводить деньги на тот же счет');
            return;
        }
        
        if (!amount || amount <= 0) {
            alert('Пожалуйста, введите корректную сумму');
            return;
        }
        
        const fromAccount = accounts.find(acc => acc.id === fromAccountId);
        const toAccount = accounts.find(acc => acc.id === toAccountId);
        
        if (!fromAccount || !toAccount) {
            alert('Ошибка: счет не найден');
            return;
        }
        
        if (fromAccount.balance < amount) {
            alert('Недостаточно средств на счете для перевода');
            return;
        }
        
        // Выполняем перевод (только изменяем балансы счетов)
        fromAccount.balance -= amount;
        toAccount.balance += amount;
        
        // Сохраняем только изменения в счетах (без создания транзакций)
        localStorage.setItem('accounts', JSON.stringify(accounts));
        
        // Обновляем интерфейс
        updateDashboard();
        renderAccounts();
        renderTransactions();
        
        // Закрываем модальное окно
        closeAllModals();
        
        // Показываем уведомление об успехе
        alert(`Перевод на сумму ${amount.toFixed(2)} ₽ выполнен успешно!`);
    }

        // Глобальная обработка ошибок браузерных расширений
        window.addEventListener('error', (e) => {
            if (e.message && (
                e.message.includes('message port closed') || 
                e.message.includes('message channel closed') ||
                e.message.includes('listener indicated an asynchronous response') ||
                e.message.includes('Extension context invalidated') ||
                e.message.includes('Could not establish connection') ||
                e.message.includes('Receiving end does not exist')
            )) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });
        
        window.addEventListener('unhandledrejection', (e) => {
            if (e.reason && e.reason.message && (
                e.reason.message.includes('message port closed') || 
                e.reason.message.includes('message channel closed') ||
                e.reason.message.includes('listener indicated an asynchronous response') ||
                e.reason.message.includes('Extension context invalidated') ||
                e.reason.message.includes('Could not establish connection') ||
                e.reason.message.includes('Receiving end does not exist')
            )) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });

        // Инициализация приложения после полной загрузки DOM
        document.addEventListener('DOMContentLoaded', initApp);
        
        // Инициализация обработчиков для кнопок с подсказками
        document.addEventListener('DOMContentLoaded', function() {
            // Добавляем обработчики для кнопок с подсказками при загрузке страницы
            setTimeout(() => {
                addPaymentHintHandlers();
                addCategoryIconHintHandlers();
                addTransferHandlers();
            }, 100);
        });

        // Добавление обработчиков для формы перевода
        function addTransferHandlers() {
            // Обработчик изменения счета списания
            const fromAccountSelect = document.getElementById('transferFromAccount');
            if (fromAccountSelect) {
                fromAccountSelect.addEventListener('change', handleFromAccountChange);
            }

            // Обработчик изменения счета зачисления
            const toAccountSelect = document.getElementById('transferToAccount');
            if (toAccountSelect) {
                toAccountSelect.addEventListener('change', updateTransferSummary);
            }

            // Обработчик изменения суммы
            const amountInput = document.getElementById('transferAmount');
            if (amountInput) {
                amountInput.addEventListener('input', updateTransferSummary);
            }

            // Обработчики для кнопок быстрого выбора суммы
            const amountHintBtns = document.querySelectorAll('.amount-hint-btn');
            amountHintBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    const amount = parseFloat(this.dataset.amount);
                    setTransferAmount(amount);
                });
            });
        }

        // Обработчик изменения размера окна
        window.addEventListener('resize', () => {
            const activeTab = document.querySelector('.tab-item.active');
            if (activeTab) {
                updateTabIndicator(activeTab);
            }
        });

        // Обработчик клавиши Escape для закрытия модальных окон
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAllModals();
            }
        });

        // Создание и инициализация плавающего виджета
        function createFloatingWidget() {
            const floatingActionWidget = document.createElement('div');
            floatingActionWidget.className = 'floating-action-widget';
            floatingActionWidget.id = 'floatingActionWidget';
            floatingActionWidget.innerHTML = `
                <div class="fab-menu" id="fabMenu">
                    <div class="fab-item fab-expense" id="fabExpense" title="Добавить расход" onclick="openExpenseModal()">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M19 13H5v-2h14v2z"/>
                        </svg>
                        <span>Расход</span>
                    </div>
                    <div class="fab-item fab-income" id="fabIncome" title="Добавить доход" onclick="openIncomeModal()">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                        <span>Доход</span>
                    </div>
                </div>
                <div class="fab-main" id="fabMain">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                </div>
            `;
            document.body.appendChild(floatingActionWidget);

            // Обработчики для плавающего виджета
            const fabMain = document.getElementById('fabMain');
            const fabMenu = document.getElementById('fabMenu');
            const fabExpense = document.getElementById('fabExpense');
            const fabIncome = document.getElementById('fabIncome');

            if (fabMain && fabMenu && fabExpense && fabIncome) {
                // Переключение меню
                fabMain.addEventListener('click', function() {
                    fabMenu.classList.toggle('active');
                    fabMain.classList.toggle('active');
                });

                // Добавление расхода
                fabExpense.addEventListener('click', function() {
                    openExpenseModal();
                    fabMenu.classList.remove('active');
                    fabMain.classList.remove('active');
                });

                // Добавление дохода
                fabIncome.addEventListener('click', function() {
                    openIncomeModal();
                    fabMenu.classList.remove('active');
                    fabMain.classList.remove('active');
                });

                // Закрытие меню при клике вне виджета
                document.addEventListener('click', function(e) {
                    if (!e.target.closest('.floating-action-widget')) {
                        fabMenu.classList.remove('active');
                        fabMain.classList.remove('active');
                    }
                });
            }
        }

        // Инициализация плавающего виджета при загрузке страницы
        document.addEventListener('DOMContentLoaded', function() {
            createFloatingWidget();
        });

        // Инициализация настроек валют при загрузке DOM
        document.addEventListener('DOMContentLoaded', function() {
            // Загружаем настройки валют после полной загрузки DOM
            setTimeout(() => {
                loadCurrencySettings();
                console.log('Настройки валют инициализированы при загрузке DOM');
            }, 200);
                });
        
        // Дополнительная проверка кнопки добавления счета
        setTimeout(() => {
            const addAccountBtn = document.getElementById('addAccountBtn');

            if (addAccountBtn) {
                addAccountBtn.addEventListener('click', () => {
                    openAccountModal();
                });
            }
        }, 1000);
        
        // Временная кнопка для очистки localStorage (для тестирования)
        // Раскомментируйте следующую строку для очистки данных:
        // localStorage.clear();
        
        // Инициализация приложения
        initApp();

