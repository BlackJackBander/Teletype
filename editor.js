document.addEventListener('DOMContentLoaded', function() {
    // Основные элементы
    const editor = document.getElementById('editor');
    const toolbar = document.getElementById('toolbar');
    const exportBtn = document.getElementById('exportBtn');
    const quoteBtn = document.getElementById('quoteBtn');
    const codeBtn = document.getElementById('codeBtn');
    const languageBtn = document.getElementById('languageBtn');
    const backToStartBtn = document.getElementById('backToStartBtn');
    const saveStatus = document.getElementById('saveStatus');
    const wordCount = document.getElementById('wordCount');
    const notification = document.getElementById('notification');
    const languageModal = document.getElementById('languageModal');
    const modalClose = document.querySelector('.modal-close');
    
    // Состояние редактора
    let autoSaveInterval;
    let currentDocumentTitle = '';
    let currentLanguage = 'javascript';
    let currentDocumentId = null;
    
    // Управление dropdown
    let activeDropdown = null;
    let dropdownTriggers = [];
    
    // Для отслеживания двойного Enter
    let lastEnterTime = 0;
    let enterCount = 0;
    let isInSpecialBlock = false;
    let exitHint = null;
    
    // Менеджер истории
    let historyManager = {
        stack: [],
        index: -1,
        maxSteps: 100,
        isSaving: false,
        
        // Сохраняем состояние редактора
        saveState: function() {
            if (this.isSaving) return;
            
            this.isSaving = true;
            const state = editor.innerHTML;
            
            // Если мы находимся не в конце истории, отрезаем будущие состояния
            if (this.index < this.stack.length - 1) {
                this.stack = this.stack.slice(0, this.index + 1);
            }
            
            this.stack.push(state);
            this.index++;
            
            // Ограничиваем размер истории
            if (this.stack.length > this.maxSteps) {
                this.stack.shift();
                this.index--;
            }
            
            this.isSaving = false;
        },
        
        // Отмена действия
        undo: function() {
            if (this.index > 0) {
                this.index--;
                this.restoreState();
                return true;
            }
            return false;
        },
        
        // Возврат действия
        redo: function() {
            if (this.index < this.stack.length - 1) {
                this.index++;
                this.restoreState();
                return true;
            }
            return false;
        },
        
        // Восстановление состояния
        restoreState: function() {
            const state = this.stack[this.index];
            if (state) {
                editor.innerHTML = state;
                
                // Восстанавливаем подсветку синтаксиса
                setTimeout(() => {
                    if (typeof hljs !== 'undefined') {
                        document.querySelectorAll('pre code').forEach((block) => {
                            if (!block.classList.contains('hljs')) {
                                hljs.highlightElement(block);
                                addCodeBlockFeatures(block.parentNode);
                            }
                        });
                    }
                    updateStats();
                }, 10);
            }
        }
    };
    
    // Инициализация
    init();
    
    function init() {
        // Загружаем текущий документ
        loadCurrentDocument();
        
        // Инициализируем панель инструментов
        initToolbar();
        
        // Инициализируем Highlight.js
        initHighlightJS();
        
        // Запускаем автосохранение
        startAutoSave();
        
        // Обновляем статистику
        updateStats();
        
        // Фокус на редактор
        editor.focus();
        
        // Закрываем все dropdown при инициализации
        closeAllDropdowns();
        
        // Создаем подсказку о двойном Enter
        createExitHint();
        
        // Инициализируем историю после загрузки контента
        setTimeout(() => {
            historyManager.saveState();
        }, 500);
    }
    
    function createExitHint() {
        exitHint = document.createElement('div');
        exitHint.className = 'exit-hint';
        exitHint.textContent = 'Нажмите Enter дважды для выхода';
        document.body.appendChild(exitHint);
    }
    
    function showExitHint(x, y) {
        if (!exitHint) return;
        
        exitHint.style.left = (x - 50) + 'px';
        exitHint.style.top = (y - 10) + 'px';
        exitHint.classList.add('show');
        
        // Автоматически скрываем через 2 секунды
        setTimeout(() => {
            exitHint.classList.remove('show');
        }, 2000);
    }
    
    function loadCurrentDocument() {
        chrome.runtime.sendMessage({action: "getCurrentDocument"}, function(docId) {
            if (docId) {
                currentDocumentId = docId;
                loadDocumentContent();
            } else {
                showNotification('Создан новый документ', 'info');
            }
        });
    }
    
    function initToolbar() {
        // Собираем все триггеры dropdown
        dropdownTriggers = document.querySelectorAll('.toolbar-dropdown-trigger');
        
        // Инициализируем обработчики для dropdown
        initDropdowns();
        
        // Обработчики для стилей текста
        document.querySelectorAll('[data-style]').forEach(btn => {
            btn.addEventListener('click', function() {
                const style = this.getAttribute('data-style');
                applyStyle(style);
                hideNotification();
            });
        });
        
        // Обработчики для выравнивания
        document.querySelectorAll('[data-align]').forEach(btn => {
            btn.addEventListener('click', function() {
                const align = this.getAttribute('data-align');
                applyAlignment(align);
                hideNotification();
            });
        });
        
        // Обработчики для базового форматирования
        document.querySelectorAll('[data-command]').forEach(btn => {
            btn.addEventListener('click', function() {
                const command = this.getAttribute('data-command');
                
                // Заменяем execCommand на безопасные функции
                switch(command) {
                    case 'bold':
                        applyBold();
                        break;
                    case 'italic':
                        applyItalic();
                        break;
                    case 'underline':
                        applyUnderline();
                        break;
                    case 'strikeThrough':
                        applyStrikeThrough();
                        break;
                }
                
                this.classList.toggle('active');
                updateStats();
                hideNotification();
            });
        });
        
        // Кнопка цитаты
        quoteBtn.addEventListener('click', function() {
            applyStyle('blockquote');
            this.classList.toggle('active');
            hideNotification();
        });
        
        // Кнопка кода
        codeBtn.addEventListener('click', function() {
            insertCodeBlock();
            this.classList.toggle('active');
            hideNotification();
        });
        
        // Кнопка выбора языка
        languageBtn.addEventListener('click', function() {
            languageModal.classList.add('show');
        });
        
        // Кнопка экспорта
        exportBtn.addEventListener('click', function() {
            exportDocument();
        });
        
        // Кнопка возврата к стартовому экрану
        backToStartBtn.addEventListener('click', function() {
            window.location.href = 'start.html';
        });
        
        // Обработчик для закрытия модального окна
        modalClose.addEventListener('click', function() {
            languageModal.classList.remove('show');
        });
        
        // Закрытие модального окна при клике вне его
        languageModal.addEventListener('click', function(e) {
            if (e.target === languageModal) {
                languageModal.classList.remove('show');
            }
        });
        
        // Обработчики для кнопок выбора языка
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const lang = this.getAttribute('data-lang');
                currentLanguage = lang;
                
                // Обновляем подсветку текущего блока кода, если есть выделение
                const selection = window.getSelection();
                if (selection.toString().trim()) {
                    const range = selection.getRangeAt(0);
                    const codeBlock = range.startContainer.parentNode.closest('pre');
                    
                    if (codeBlock) {
                        const codeElement = codeBlock.querySelector('code');
                        if (codeElement) {
                            codeElement.className = lang === 'plaintext' ? '' : `language-${lang}`;
                            if (lang !== 'plaintext' && typeof hljs !== 'undefined') {
                                hljs.highlightElement(codeElement);
                            }
                            
                            updateCodeLanguageBadge(codeBlock, lang);
                        }
                    }
                }
                
                languageModal.classList.remove('show');
                showNotification(`Язык изменен на: ${getLanguageDisplayName(lang)}`, 'success');
                closeAllDropdowns();
            });
        });
        
        // Кнопки Undo/Redo
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) {
            undoBtn.addEventListener('click', function() {
                if (historyManager.undo()) {
                    showNotification('Действие отменено', 'info');
                    this.classList.add('active');
                    setTimeout(() => this.classList.remove('active'), 300);
                }
            });
        }
        
        if (redoBtn) {
            redoBtn.addEventListener('click', function() {
                if (historyManager.redo()) {
                    showNotification('Действие возвращено', 'info');
                    this.classList.add('active');
                    setTimeout(() => this.classList.remove('active'), 300);
                }
            });
        }
        
        // Добавляем обработчик для двойного Enter
        editor.addEventListener('keydown', handleKeyDown, true);
        
        // Отслеживаем изменение позиции курсора
        editor.addEventListener('click', checkIfInSpecialBlock);
        editor.addEventListener('keyup', checkIfInSpecialBlock);
    }
    
    function checkIfInSpecialBlock() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        
        // Проверяем, находимся ли мы в блоке цитаты или кода
        const blockquote = node.closest('blockquote');
        const codeBlock = node.closest('pre');
        
        isInSpecialBlock = !!(blockquote || codeBlock);
        
        // Показываем подсказку только если в специальном блоке и есть фокус
        if (isInSpecialBlock && document.activeElement === editor) {
            const rect = range.getBoundingClientRect();
            showExitHint(rect.left + window.scrollX, rect.top + window.scrollY - 30);
        }
    }
    
    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            const now = Date.now();
            const selection = window.getSelection();
            
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            const node = range.startContainer;
            
            // Проверяем, находимся ли мы в специальном блоке
            const blockquote = node.closest('blockquote');
            const codeBlock = node.closest('pre');
            
            if (blockquote || codeBlock) {
                // Проверяем двойное нажатие Enter
                if (now - lastEnterTime < 300) {
                    enterCount++;
                    
                    if (enterCount >= 2) {
                        e.preventDefault();
                        
                        if (blockquote) {
                            exitFromBlockquote(blockquote, range);
                        } else if (codeBlock) {
                            exitFromCodeBlock(codeBlock, range);
                        }
                        
                        enterCount = 0;
                        lastEnterTime = 0;
                        return;
                    }
                } else {
                    enterCount = 1;
                }
                
                lastEnterTime = now;
            } else {
                // Сбрасываем счетчик, если не в специальном блоке
                enterCount = 0;
                lastEnterTime = 0;
            }
        } else {
            // Сбрасываем счетчик при нажатии других клавиш
            enterCount = 0;
        }
    }
    
    function exitFromBlockquote(blockquote, range) {
        // Сохраняем состояние перед изменением
        historyManager.saveState();
        
        // Добавляем визуальный эффект
        blockquote.classList.add('exiting');
        
        // Создаем новый параграф после цитаты
        const newParagraph = document.createElement('p');
        newParagraph.innerHTML = '<br>';
        
        // Вставляем после цитаты
        if (blockquote.nextSibling) {
            blockquote.parentNode.insertBefore(newParagraph, blockquote.nextSibling);
        } else {
            blockquote.parentNode.appendChild(newParagraph);
        }
        
        // Устанавливаем курсор в новый параграф
        const newRange = document.createRange();
        newRange.setStart(newParagraph, 0);
        newRange.collapse(true);
        
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        // Прокручиваем к новому положению курсора
        newParagraph.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Убираем эффект через некоторое время
        setTimeout(() => {
            blockquote.classList.remove('exiting');
        }, 1000);
        
        showNotification('Вы вышли из цитаты', 'info');
        updateStats();
    }
    
    function exitFromCodeBlock(codeBlock, range) {
        // Сохраняем состояние перед изменением
        historyManager.saveState();
        
        // Добавляем визуальный эффект
        codeBlock.classList.add('exiting');
        
        // Создаем новый параграф после блока кода
        const newParagraph = document.createElement('p');
        newParagraph.innerHTML = '<br>';
        
        // Вставляем после блока кода
        if (codeBlock.nextSibling) {
            codeBlock.parentNode.insertBefore(newParagraph, codeBlock.nextSibling);
        } else {
            codeBlock.parentNode.appendChild(newParagraph);
        }
        
        // Устанавливаем курсор в новый параграф
        const newRange = document.createRange();
        newRange.selectNodeContents(newParagraph);
        newRange.collapse(true);
        
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        // Прокручиваем к новому положению курсора
        setTimeout(() => {
            newParagraph.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        
        showNotification('Вы вышли из блока кода', 'info');
        updateStats();
        
        // Убираем эффект через некоторое время
        setTimeout(() => {
            codeBlock.classList.remove('exiting');
        }, 1000);
    }
    
    function initDropdowns() {
        // Обработчики для каждого триггера dropdown
        dropdownTriggers.forEach(trigger => {
            const dropdown = trigger.nextElementSibling;
            
            if (dropdown && dropdown.classList.contains('toolbar-dropdown')) {
                trigger.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const isActive = this.classList.contains('active');
                    closeAllDropdowns();
                    
                    if (!isActive) {
                        openDropdown(this, dropdown);
                    }
                });
            }
        });
        
        // Обработчики для элементов внутри dropdown
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                
                const dropdown = this.closest('.toolbar-dropdown');
                if (dropdown) {
                    closeDropdown(dropdown);
                }
                
                const trigger = dropdown.previousElementSibling;
                if (trigger && trigger.classList.contains('toolbar-dropdown-trigger')) {
                    trigger.classList.remove('active');
                }
            });
        });
        
        // Обработчик для закрытия dropdown при клике вне их
        document.addEventListener('click', function(e) {
            const isDropdownTrigger = e.target.closest('.toolbar-dropdown-trigger');
            const isDropdownItem = e.target.closest('.dropdown-item');
            const isDropdown = e.target.closest('.toolbar-dropdown');
            
            if (!isDropdownTrigger && !isDropdownItem && !isDropdown) {
                closeAllDropdowns();
            }
        });
        
        // Обработчик для клавиши Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && activeDropdown) {
                closeAllDropdowns();
            }
        });
        
        // Обработчик изменения размера окна
        window.addEventListener('resize', function() {
            if (activeDropdown) {
                closeAllDropdowns();
            }
        });
    }
    
    function openDropdown(trigger, dropdown) {
        if (activeDropdown && activeDropdown !== dropdown) {
            closeDropdown(activeDropdown);
        }
        
        trigger.classList.add('active');
        dropdown.classList.add('active');
        activeDropdown = dropdown;
    }
    
    function closeDropdown(dropdown) {
        if (!dropdown) return;
        
        const trigger = dropdown.previousElementSibling;
        if (trigger && trigger.classList.contains('toolbar-dropdown-trigger')) {
            trigger.classList.remove('active');
        }
        
        dropdown.classList.remove('active');
        
        if (activeDropdown === dropdown) {
            activeDropdown = null;
        }
    }
    
    function closeAllDropdowns() {
        document.querySelectorAll('.toolbar-dropdown.active').forEach(dropdown => {
            closeDropdown(dropdown);
        });
    }
    
    function initHighlightJS() {
        if (typeof hljs !== 'undefined') {
            hljs.configure({
                languages: ['javascript', 'python', 'java', 'cpp', 'html', 'css', 'php', 'sql', 'json', 'xml', 'bash', 'typescript', 'go', 'rust']
            });
            
            setTimeout(() => {
                document.querySelectorAll('pre code').forEach((block) => {
                    if (!block.classList.contains('hljs')) {
                        hljs.highlightElement(block);
                        addCodeBlockFeatures(block.parentNode);
                    }
                });
            }, 100);
        }
    }
    
    // Общая функция для применения форматирования с историей
    function applyFormatting(createElementCallback) {
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) return false;
        
        const range = selection.getRangeAt(0);
        
        // Сохраняем текущее состояние перед изменением
        historyManager.saveState();
        
        // Выполняем форматирование
        const result = createElementCallback(range);
        
        // Обновляем статистику
        updateStats();
        
        return result;
    }
    
    function applyBold() {
        return applyFormatting((range) => {
            const selection = window.getSelection();
            // Проверяем, уже ли выделение в strong
            let parent = range.commonAncestorContainer;
            if (parent.nodeType === Node.TEXT_NODE) parent = parent.parentNode;
            
            if (parent.tagName === 'STRONG' || parent.closest('strong')) {
                // Если уже жирный - удаляем форматирование
                const text = range.extractContents().textContent;
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.selectNodeContents(textNode);
            } else {
                // Добавляем жирное начертание
                const strong = document.createElement('strong');
                const fragment = range.extractContents();
                strong.appendChild(fragment);
                range.insertNode(strong);
            }
            
            // Обновляем выделение
            const newRange = document.createRange();
            newRange.selectNodeContents(range.commonAncestorContainer);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return true;
        });
    }
    
    function applyItalic() {
        return applyFormatting((range) => {
            const selection = window.getSelection();
            let parent = range.commonAncestorContainer;
            if (parent.nodeType === Node.TEXT_NODE) parent = parent.parentNode;
            
            if (parent.tagName === 'EM' || parent.closest('em')) {
                // Удаляем курсив
                const text = range.extractContents().textContent;
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.selectNodeContents(textNode);
            } else {
                // Добавляем курсив
                const em = document.createElement('em');
                const fragment = range.extractContents();
                em.appendChild(fragment);
                range.insertNode(em);
            }
            
            const newRange = document.createRange();
            newRange.selectNodeContents(range.commonAncestorContainer);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return true;
        });
    }
    
    function applyUnderline() {
        return applyFormatting((range) => {
            const selection = window.getSelection();
            let parent = range.commonAncestorContainer;
            if (parent.nodeType === Node.TEXT_NODE) parent = parent.parentNode;
            
            // Проверяем, есть ли уже подчеркивание
            const hasUnderline = parent.style?.textDecoration === 'underline' || 
                                parent.closest('[style*="text-decoration: underline"]');
            
            if (hasUnderline) {
                // Удаляем подчеркивание
                const text = range.extractContents().textContent;
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.selectNodeContents(textNode);
            } else {
                // Добавляем подчеркивание
                const span = document.createElement('span');
                span.style.textDecoration = 'underline';
                const fragment = range.extractContents();
                span.appendChild(fragment);
                range.insertNode(span);
            }
            
            const newRange = document.createRange();
            newRange.selectNodeContents(range.commonAncestorContainer);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return true;
        });
    }
    
    function applyStrikeThrough() {
        return applyFormatting((range) => {
            const selection = window.getSelection();
            let parent = range.commonAncestorContainer;
            if (parent.nodeType === Node.TEXT_NODE) parent = parent.parentNode;
            
            if (parent.tagName === 'S' || parent.closest('s')) {
                // Удаляем зачеркивание
                const text = range.extractContents().textContent;
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.selectNodeContents(textNode);
            } else {
                // Добавляем зачеркивание
                const s = document.createElement('s');
                const fragment = range.extractContents();
                s.appendChild(fragment);
                range.insertNode(s);
            }
            
            const newRange = document.createRange();
            newRange.selectNodeContents(range.commonAncestorContainer);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
            return true;
        });
    }
    
    function applyStyle(style) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        // Сохраняем состояние перед изменением
        historyManager.saveState();
        
        if (style === 'ul' || style === 'ol') {
            // Создаем список через DOM API
            const listElement = document.createElement(style === 'ol' ? 'ol' : 'ul');
            
            if (range.collapsed) {
                // Если нет выделения, создаем пустой элемент списка
                const li = document.createElement('li');
                li.appendChild(document.createTextNode('\u00A0'));
                listElement.appendChild(li);
                range.insertNode(listElement);
                
                // Устанавливаем курсор в элемент списка
                const newRange = document.createRange();
                newRange.setStart(li, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else {
                // Если есть выделение, оборачиваем в список
                const fragment = range.extractContents();
                const li = document.createElement('li');
                li.appendChild(fragment);
                listElement.appendChild(li);
                range.insertNode(listElement);
            }
            
        } else if (style === 'blockquote') {
            // Проверяем, находимся ли мы уже в цитате
            const blockElement = range.commonAncestorContainer.nodeType === 3 
                ? range.commonAncestorContainer.parentNode 
                : range.commonAncestorContainer;
            
            if (blockElement.closest('blockquote')) {
                exitFromBlockquote(blockElement.closest('blockquote'), range);
            } else {
                // Создаем блок цитаты
                const blockquote = document.createElement('blockquote');
                const fragment = range.extractContents();
                blockquote.appendChild(fragment);
                range.insertNode(blockquote);
            }
            
        } else if (['h1', 'h2', 'h3', 'p'].includes(style)) {
            // Для заголовков и параграфов
            const blockElement = document.createElement(style);
            
            if (range.collapsed) {
                blockElement.appendChild(document.createTextNode('\u00A0'));
                range.insertNode(blockElement);
            } else {
                const fragment = range.extractContents();
                blockElement.appendChild(fragment);
                range.insertNode(blockElement);
            }
        }
        
        updateStats();
    }
    
    function applyAlignment(align) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        const block = node.nodeType === 3 ? node.parentNode : node;
        
        // Сохраняем состояние перед изменением
        historyManager.saveState();
        
        ['text-left', 'text-center', 'text-right', 'text-justify'].forEach(cls => {
            block.classList.remove(cls);
        });
        
        block.classList.add('text-' + align);
        updateStats();
    }
    
    function insertCodeBlock() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const codeBlock = range.commonAncestorContainer.closest?.('pre');
        
        if (codeBlock) {
            showNotification('Уже в блоке кода', 'info');
            return;
        }
        
        // Сохраняем состояние перед вставкой
        historyManager.saveState();
        
        const defaultCode = getDefaultCode(currentLanguage);
        
        // Создаем элементы через DOM API
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.className = `language-${currentLanguage}`;
        code.textContent = defaultCode;
        
        pre.appendChild(code);
        
        // Вставляем пустой параграф после
        const p = document.createElement('p');
        p.appendChild(document.createTextNode('\u00A0'));
        
        // Вставляем в редактор
        if (range.collapsed) {
            range.insertNode(pre);
            range.setStartAfter(pre);
            range.insertNode(p);
            range.setStart(p, 0);
            range.collapse(true);
        } else {
            const fragment = range.extractContents();
            range.insertNode(pre);
            range.setStartAfter(pre);
            range.insertNode(p);
            range.setStart(p, 0);
            range.collapse(true);
        }
        
        // Обновляем выделение
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Подсвечиваем код
        setTimeout(() => {
            if (typeof hljs !== 'undefined') {
                hljs.highlightElement(code);
                addCodeBlockFeatures(pre);
                updateCodeLanguageBadge(pre, currentLanguage);
            }
        }, 10);
        
        updateStats();
    }
    
    function getDefaultCode(lang) {
        const templates = {
            'javascript': `// Пример JavaScript кода
function greet(name) {
    return \`Hello, \${name}!\`;
}

const result = greet("World");
console.log(result);`,
            
            'python': `# Пример Python кода
def greet(name):
    return f"Hello, {name}!"

result = greet("World")
print(result)`,
            
            'java': `// Пример Java кода
public class Main {
    public static void main(String[] args) {
        String result = greet("World");
        System.out.println(result);
    }
    
    public static String greet(String name) {
        return "Hello, " + name + "!";
    }
}`,
            
            'cpp': `// Пример C++ кода
#include <iostream>
#include <string>

std::string greet(const std::string& name) {
    return "Hello, " + name + "!";
}

int main() {
    std::string result = greet("World");
    std::cout << result << std::endl;
    return 0;
}`,
            
            'html': `<!-- Пример HTML кода -->
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Пример</title>
</head>
<body>
    <h1>Привет, мир!</h1>
    <p>Это пример HTML кода.</p>
</body>
</html>`,
            
            'css': `/* Пример CSS кода */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f0f0f0;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}`,
            
            'php': `<?php
// Пример PHP кода
function greet($name) {
    return "Hello, " . $name . "!";
}

$result = greet("World");
echo $result;
?>`,
            
            'sql': `-- Пример SQL кода
-- Создание таблицы
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Вставка данных
INSERT INTO users (username, email) 
VALUES ('john_doe', 'john@example.com');

-- Выборка данных
SELECT * FROM users WHERE username = 'john_doe';`,
            
            'json': `{
  "name": "Пример JSON",
  "version": "1.0.0",
  "description": "Пример JSON объекта",
  "author": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "dependencies": {
    "express": "^4.17.1",
    "mongodb": "^3.6.0"
  },
  "scripts": {
    "start": "node server.js",
    "test": "jest"
  }
}`,
            
            'xml': `<?xml version="1.0" encoding="UTF-8"?>
<!-- Пример XML кода -->
<bookstore>
  <book category="fiction">
    <title lang="en">Harry Potter</title>
    <author>J.K. Rowling</author>
    <year>2005</year>
    <price>29.99</price>
  </book>
  <book category="programming">
    <title lang="en">Clean Code</title>
    <author>Robert C. Martin</author>
    <year>2008</year>
    <price>39.99</price>
  </book>
</bookstore>`,
            
            'bash': `#!/bin/bash
# Пример Bash скрипта
echo "Привет, мир!"

# Проверка аргументов
if [ $# -eq 0 ]; then
    echo "Использование: $0 <имя>"
    exit 1
fi

echo "Привет, $1!"`,
            
            'typescript': `// Пример TypeScript кода
interface Person {
    name: string;
    age: number;
}

function greet(person: Person): string {
    return \`Hello, \${person.name}!\`;
}

const user: Person = { name: "World", age: 30 };
const result = greet(user);
console.log(result);`,
            
            'go': `// Пример Go кода
package main

import "fmt"

func greet(name string) string {
    return fmt.Sprintf("Hello, %s!", name)
}

func main() {
    result := greet("World")
    fmt.Println(result)
}`,
            
            'rust': `// Пример Rust кода
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn main() {
    let result = greet("World");
    println!("{}", result);
}`,
            
            'plaintext': `Введите ваш текст или код здесь.
Подсветка синтаксиса отключена для этого блока.`
        };
        
        return templates[lang] || templates['javascript'];
    }
    
    function addCodeBlockFeatures(preElement) {
        if (!preElement.querySelector('.copy-code-btn')) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-code-btn';
            copyBtn.textContent = 'Копировать';
            copyBtn.title = 'Копировать код в буфер обмена';
            
            copyBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const code = preElement.querySelector('code').textContent;
                copyToClipboard(code);
                
                const originalText = this.textContent;
                this.textContent = 'Скопировано!';
                this.style.background = '#34c759';
                this.style.color = 'white';
                
                setTimeout(() => {
                    this.textContent = originalText;
                    this.style.background = '';
                    this.style.color = '';
                }, 2000);
                
                showNotification('Код скопирован в буфер обмена', 'success');
            });
            
            preElement.appendChild(copyBtn);
        }
        
        updateCodeLanguageBadge(preElement, currentLanguage);
    }
    
    function updateCodeLanguageBadge(preElement, lang) {
        const oldBadge = preElement.querySelector('.code-language');
        if (oldBadge) {
            oldBadge.remove();
        }
        
        if (lang !== 'plaintext') {
            const badge = document.createElement('div');
            badge.className = 'code-language';
            badge.textContent = getLanguageDisplayName(lang);
            preElement.appendChild(badge);
        }
    }
    
    function getLanguageDisplayName(lang) {
        const names = {
            'javascript': 'JavaScript',
            'python': 'Python',
            'java': 'Java',
            'cpp': 'C++',
            'html': 'HTML',
            'css': 'CSS',
            'php': 'PHP',
            'sql': 'SQL',
            'json': 'JSON',
            'xml': 'XML',
            'bash': 'Bash',
            'typescript': 'TypeScript',
            'go': 'Go',
            'rust': 'Rust',
            'plaintext': 'Текст'
        };
        
        return names[lang] || lang;
    }
    
    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
    
    function updateStats() {
        const text = editor.innerText.trim();
        const words = text ? text.split(/\s+/).length : 0;
        
        wordCount.textContent = `${words} слов`;
        
        const firstLine = text.split('\n')[0] || '';
        currentDocumentTitle = firstLine.substring(0, 50);
    }
    
    function loadDocumentContent() {
        chrome.runtime.sendMessage({action: "loadContent"}, function(data) {
            if (data && data.content) {
                // Используем DOMParser вместо innerHTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(data.content, 'text/html');
                
                // Очищаем редактор безопасно
                while (editor.firstChild) {
                    editor.removeChild(editor.firstChild);
                }
                
                // Копируем содержимое из распарсенного документа
                Array.from(doc.body.childNodes).forEach(node => {
                    editor.appendChild(node.cloneNode(true));
                });
                
                if (data.currentLanguage) {
                    currentLanguage = data.currentLanguage;
                }
                updateStats();
                
                setTimeout(() => {
                    if (typeof hljs !== 'undefined') {
                        document.querySelectorAll('pre code').forEach((block) => {
                            if (!block.classList.contains('hljs')) {
                                hljs.highlightElement(block);
                                addCodeBlockFeatures(block.parentNode);
                            }
                        });
                    }
                }, 100);
            }
        });
    }
    
    function saveDocument() {
        const data = {
            content: editor.innerHTML,
            title: currentDocumentTitle,
            currentLanguage: currentLanguage,
            lastModified: Date.now()
        };
        
        chrome.runtime.sendMessage({
            action: "saveContent",
            data: data
        }, function(response) {
            if (response && response.status === "saved") {
                saveStatus.textContent = '● Сохранено';
                saveStatus.style.color = '#34c759';
                
                setTimeout(() => {
                    saveStatus.textContent = '● Автосохранение';
                    saveStatus.style.color = '';
                }, 2000);
            }
        });
    }
    
    function exportDocument() {
        const metadata = {
            title: currentDocumentTitle || 'Документ',
            exported: new Date().toISOString()
        };
        
        chrome.runtime.sendMessage({
            action: "exportHTML",
            content: editor.innerHTML,
            metadata: metadata
        }, function(response) {
            if (response && response.status === "exported") {
                showNotification('Документ экспортирован', 'success');
            }
        });
    }
    
    function startAutoSave() {
        let hasChanges = false;
        let lastContent = editor.innerHTML;
        let historyTimer;
        
        function checkForChanges() {
            const currentContent = editor.innerHTML;
            if (currentContent !== lastContent) {
                hasChanges = true;
                lastContent = currentContent;
                updateStats();
                
                // Откладываем сохранение истории для группировки быстрых изменений
                clearTimeout(historyTimer);
                historyTimer = setTimeout(() => {
                    historyManager.saveState();
                }, 1000);
            }
        }
        
        // Отслеживаем изменения через MutationObserver
        const observer = new MutationObserver(function(mutations) {
            if (mutations.some(m => m.type === 'childList' || m.type === 'characterData')) {
                checkForChanges();
            }
        });
        
        observer.observe(editor, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        // Также отслеживаем ввод
        editor.addEventListener('input', function() {
            hasChanges = true;
            updateStats();
        });
        
        autoSaveInterval = setInterval(() => {
            if (hasChanges) {
                saveDocument();
                hasChanges = false;
            }
        }, 5000);
    }
    
    function showNotification(message, type = 'info') {
        closeAllDropdowns();
        
        notification.textContent = message;
        notification.className = 'notification';
        
        if (type === 'success') {
            notification.style.borderLeftColor = '#34c759';
        } else if (type === 'error') {
            notification.style.borderLeftColor = '#ff3b30';
        } else {
            notification.style.borderLeftColor = '#4a90e2';
        }
        
        notification.classList.add('show');
        
        setTimeout(hideNotification, 3000);
    }
    
    function hideNotification() {
        notification.classList.remove('show');
    }
    
    // Горячие клавиши
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            switch(e.key.toLowerCase()) {
                case 'z':
                    if (e.shiftKey) {
                        // Ctrl+Shift+Z для Redo
                        e.preventDefault();
                        if (historyManager.redo()) {
                            showNotification('Действие возвращено', 'info');
                        }
                    } else {
                        // Ctrl+Z для Undo
                        e.preventDefault();
                        if (historyManager.undo()) {
                            showNotification('Действие отменено', 'info');
                        }
                    }
                    break;
                case 'y':
                    // Ctrl+Y для Redo
                    e.preventDefault();
                    if (historyManager.redo()) {
                        showNotification('Действие возвращено', 'info');
                    }
                    break;
                case 'b':
                    e.preventDefault();
                    applyBold();
                    document.querySelector('[data-command="bold"]').classList.toggle('active');
                    break;
                case 'i':
                    e.preventDefault();
                    applyItalic();
                    document.querySelector('[data-command="italic"]').classList.toggle('active');
                    break;
                case 'u':
                    e.preventDefault();
                    applyUnderline();
                    document.querySelector('[data-command="underline"]').classList.toggle('active');
                    break;
                case '`':
                    e.preventDefault();
                    insertCodeBlock();
                    showNotification('Блок кода вставлен', 'success');
                    break;
                case '1':
                    e.preventDefault();
                    applyStyle('h1');
                    break;
                case '2':
                    e.preventDefault();
                    applyStyle('h2');
                    break;
                case '3':
                    e.preventDefault();
                    applyStyle('h3');
                    break;
                case '0':
                    e.preventDefault();
                    applyStyle('p');
                    break;
            }
        }
        
        if (e.key === 'Escape' && activeDropdown) {
            e.preventDefault();
            closeAllDropdowns();
        }
    });
    
    // Автосохранение при закрытии
    window.addEventListener('beforeunload', function() {
        saveDocument();
    });
    
    // Управление панелью инструментов с клавиатуры
    toolbar.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            editor.focus();
        }
    });
});