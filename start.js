document.addEventListener('DOMContentLoaded', function() {
    // Основные элементы
    const documentsList = document.getElementById('documentsList');
    const searchInput = document.getElementById('searchInput');
    const newDocumentBtn = document.getElementById('newDocumentBtn');
    const importBtn = document.getElementById('importBtn');
    const aboutBtn = document.getElementById('aboutBtn');
    
    // Модальное окно
    const newDocModal = document.getElementById('newDocModal');
    const newDocTitle = document.getElementById('newDocTitle');
    const createDocBtn = document.getElementById('createDocBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    // Состояние
    let allDocuments = [];
    let currentSearch = '';
    
    // Инициализация
    init();
    
    function init() {
        // Загружаем документы
        loadDocuments();
        
        // Инициализируем обработчики
        initEventListeners();
    }
    
    function initEventListeners() {
        // Поиск
        searchInput.addEventListener('input', function() {
            currentSearch = this.value.toLowerCase();
            filterDocuments();
        });
        
        // Новая кнопка документа
        newDocumentBtn.addEventListener('click', function() {
            showNewDocumentModal();
        });
        
        // Импорт
        importBtn.addEventListener('click', function() {
            importHTMLFile();
        });
        
        // О программе
        if (aboutBtn) {
            aboutBtn.addEventListener('click', function() {
                chrome.tabs.create({ url: chrome.runtime.getURL('about.html') });
            });
        }
        
        // Модальное окно
        createDocBtn.addEventListener('click', function() {
            createNewDocument();
        });
        
        cancelBtn.addEventListener('click', function() {
            newDocModal.style.display = 'none';
        });
        
        // Enter в поле названия документа
        newDocTitle.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                createNewDocument();
            }
        });
        
        // Закрытие модального окна при клике вне его
        window.addEventListener('click', function(e) {
            if (e.target === newDocModal) {
                newDocModal.style.display = 'none';
            }
        });
    }
    
    function loadDocuments() {
        // Загружаем документы из хранилища
        chrome.storage.local.get(null, function(items) {
            allDocuments = [];
            
            // Ищем все документы
            for (const key in items) {
                if (key.startsWith('teletype_doc_')) {
                    const doc = items[key];
                    doc.id = key;
                    allDocuments.push(doc);
                }
            }
            
            // Сортируем по дате изменения (новые первые)
            allDocuments.sort((a, b) => {
                return (b.lastModified || 0) - (a.lastModified || 0);
            });
            
            // Отображаем документы
            renderDocuments();
        });
    }
    
    function renderDocuments() {
        const container = documentsList;
        container.innerHTML = '';
        
        if (allDocuments.length === 0) {
            // Создаем empty-state через createElement
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            
            const icon = document.createElement('div');
            icon.className = 'icon';
            icon.textContent = '📝';
            
            const text1 = document.createElement('div');
            text1.textContent = 'Нет сохраненных документов';
            
            const text2 = document.createElement('div');
            text2.textContent = 'Создайте новый документ, чтобы начать работу';
            text2.style.fontSize = '13px';
            text2.style.marginTop = '10px';
            
            emptyState.appendChild(icon);
            emptyState.appendChild(text1);
            emptyState.appendChild(text2);
            container.appendChild(emptyState);
            return;
        }
        
        // Фильтруем документы если есть поиск
        const filteredDocs = currentSearch 
            ? allDocuments.filter(doc => 
                (doc.title && doc.title.toLowerCase().includes(currentSearch)) ||
                (doc.content && doc.content.toLowerCase().includes(currentSearch)))
            : allDocuments;
        
        if (filteredDocs.length === 0) {
            // Создаем empty-state для поиска
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            
            const icon = document.createElement('div');
            icon.className = 'icon';
            icon.textContent = '🔍';
            
            const text1 = document.createElement('div');
            text1.textContent = 'Ничего не найдено';
            
            const text2 = document.createElement('div');
            text2.textContent = 'Попробуйте изменить поисковый запрос';
            text2.style.fontSize = '13px';
            text2.style.marginTop = '10px';
            
            emptyState.appendChild(icon);
            emptyState.appendChild(text1);
            emptyState.appendChild(text2);
            container.appendChild(emptyState);
            return;
        }
        
        // Кнопка нового документа (безопасное создание)
        const newCard = document.createElement('div');
        newCard.className = 'document-card new';
        newCard.dataset.action = 'new';
        
        const newTitle = document.createElement('div');
        newTitle.className = 'document-title';
        newTitle.textContent = '+ Новый документ';
        
        const newMeta = document.createElement('div');
        newMeta.className = 'document-meta';
        
        const newMetaSpan = document.createElement('span');
        newMetaSpan.textContent = 'Начните с чистого листа';
        newMeta.appendChild(newMetaSpan);
        
        newCard.appendChild(newTitle);
        newCard.appendChild(newMeta);
        container.appendChild(newCard);
        
        // Существующие документы
        filteredDocs.forEach((doc, index) => {
            const date = doc.lastModified ? new Date(doc.lastModified) : new Date();
            const formattedDate = formatDate(date);
            const wordCount = doc.content ? 
                doc.content.replace(/<[^>]*>/g, ' ').split(/\s+/).length : 0;
            
            const card = document.createElement('div');
            card.className = 'document-card';
            card.dataset.id = doc.id;
            card.dataset.index = index;
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'document-title';
            titleDiv.textContent = doc.title || 'Без названия';
            
            const metaDiv = document.createElement('div');
            metaDiv.className = 'document-meta';
            
            const dateSpan = document.createElement('span');
            dateSpan.textContent = formattedDate;
            
            const countSpan = document.createElement('span');
            countSpan.textContent = `${wordCount} слов`;
            
            metaDiv.appendChild(dateSpan);
            metaDiv.appendChild(countSpan);
            
            card.appendChild(titleDiv);
            card.appendChild(metaDiv);
            container.appendChild(card);
        });
        
        // Обработчики событий
        attachCardHandlers();
    }
    
    function attachCardHandlers() {
        documentsList.querySelectorAll('.document-card').forEach(card => {
            card.addEventListener('click', function() {
                const docId = this.dataset.id;
                const action = this.dataset.action;
                
                if (action === 'new') {
                    showNewDocumentModal();
                } else if (docId) {
                    openDocument(docId);
                }
            });
        });
    }
    
    function filterDocuments() {
        renderDocuments();
    }
    
    function showNewDocumentModal() {
        newDocTitle.value = '';
        newDocModal.style.display = 'flex';
        newDocTitle.focus();
    }
    
    function createNewDocument() {
        const title = newDocTitle.value.trim();
        
        if (!title) {
            alert('Введите название документа');
            return;
        }
        
        // Создаем ID для документа
        const docId = 'teletype_doc_' + Date.now();
        
        // Создаем новый документ
        const newDoc = {
            title: title,
            content: '<p></p>',
            lastModified: Date.now(),
            currentLanguage: 'javascript'
        };
        
        // Сохраняем документ
        chrome.storage.local.set({ [docId]: newDoc }, function() {
            newDocModal.style.display = 'none';
            
            // Обновляем список и открываем документ
            allDocuments.unshift(newDoc);
            newDoc.id = docId;
            renderDocuments();
            
            // Открываем редактор с новым документом
            setTimeout(() => {
                openDocument(docId);
            }, 100);
        });
    }
    
    function openDocument(docId) {
        // Сохраняем ID текущего документа
        chrome.storage.local.set({ 
            'teletype_current_document': docId 
        }, function() {
            // Открываем редактор
            window.location.href = 'editor.html';
        });
    }
    
    function importHTMLFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.htm,.txt';
        
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const content = e.target.result;
                    
                    // Извлекаем текст из HTML
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(content, 'text/html');
                    
                    // Создаем имя файла из названия файла
                    const fileName = file.name.replace(/\.[^/.]+$/, '');
                    
                    // Создаем ID для документа
                    const docId = 'teletype_doc_' + Date.now();
                    
                    // Создаем новый документ
                    const newDoc = {
                        title: fileName,
                        content: content,
                        lastModified: Date.now(),
                        currentLanguage: 'plaintext',
                        imported: true
                    };
                    
                    // Сохраняем документ
                    chrome.storage.local.set({ [docId]: newDoc }, function() {
                        alert('Документ импортирован');
                        
                        // Обновляем список
                        allDocuments.unshift(newDoc);
                        newDoc.id = docId;
                        renderDocuments();
                    });
                    
                } catch (error) {
                    alert('Ошибка при импорте файла');
                    console.error('Import error:', error);
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    function formatDate(date) {
        const now = new Date();
        const diff = now - date;
        
        // Сегодня
        if (diff < 24 * 60 * 60 * 1000) {
            return 'Сегодня';
        }
        
        // Вчера
        if (diff < 2 * 24 * 60 * 60 * 1000) {
            return 'Вчера';
        }
        
        // На этой неделе
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            return days[date.getDay()];
        }
        
        // Старая дата
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});