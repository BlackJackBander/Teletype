// Открываем стартовую страницу при клике на иконку расширения
chrome.browserAction.onClicked.addListener(function() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('start.html'),
    active: true
  });
});

// Автосохранение
let isSaving = false;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "saveContent") {
    saveContent(request.data);
    sendResponse({status: "saved"});
  }
  else if (request.action === "loadContent") {
    loadContent(sendResponse);
    return true;
  }
  else if (request.action === "exportHTML") {
    exportHTML(request.content, request.metadata);
    sendResponse({status: "exported"});
  }
  else if (request.action === "getCurrentDocument") {
    getCurrentDocument(sendResponse);
    return true;
  }
  else if (request.action === "saveDocument") {
    saveDocument(request.docId, request.data);
    sendResponse({status: "saved"});
  }
  else if (request.action === "loadDocument") {
    loadDocument(request.docId, sendResponse);
    return true;
  }
});

function saveContent(data) {
  if (isSaving) return;
  
  isSaving = true;
  
  chrome.storage.local.get(['teletype_current_document'], function(result) {
    const docId = result.teletype_current_document;
    
    if (docId) {
      if (docId.startsWith('teletype_new_temp_')) {
        const newDocId = 'teletype_doc_' + Date.now();
        
        chrome.storage.local.set({ 
          [newDocId]: data,
          'teletype_current_document': newDocId
        }, function() {
          isSaving = false;
        });
      } else {
        chrome.storage.local.set({ 
          [docId]: data
        }, function() {
          isSaving = false;
        });
      }
    } else {
      const newDocId = 'teletype_doc_' + Date.now();
      
      chrome.storage.local.set({ 
        [newDocId]: data,
        'teletype_current_document': newDocId
      }, function() {
        isSaving = false;
      });
    }
  });
}

function loadContent(callback) {
  chrome.storage.local.get(['teletype_current_document'], function(result) {
    const docId = result.teletype_current_document;
    
    if (docId) {
      chrome.storage.local.get([docId], function(data) {
        callback(data[docId] || null);
      });
    } else {
      callback(null);
    }
  });
}

function getCurrentDocument(callback) {
  chrome.storage.local.get(['teletype_current_document'], function(result) {
    callback(result.teletype_current_document || null);
  });
}

function saveDocument(docId, data) {
  chrome.storage.local.set({ 
    [docId]: data
  });
}

function loadDocument(docId, callback) {
  chrome.storage.local.get([docId], function(data) {
    callback(data[docId] || null);
  });
}

function exportHTML(content, metadata) {
  const fullHTML = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title || 'Документ'}</title>
    <link rel="stylesheet" href="../ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
    <script src="../ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/javascript.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/python.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/java.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/cpp.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/css.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/php.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/sql.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/json.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/xml.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/bash.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/typescript.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/go.min.js"></script>
    <script src="../ajax/libs/highlight.js/11.8.0/languages/rust.min.js"></script>
    <style>
        body {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        h1 { 
            font-size: 28px; 
            font-weight: 600; 
            color: #222; 
            margin: 24px 0 12px;
            line-height: 1.3;
            border-bottom: 1px solid #eee;
            padding-bottom: 6px;
        }
        h2 { 
            font-size: 22px; 
            font-weight: 600; 
            color: #222; 
            margin: 20px 0 10px;
            line-height: 1.3;
        }
        h3 { 
            font-size: 18px; 
            font-weight: 600; 
            color: #333; 
            margin: 16px 0 8px;
            line-height: 1.4;
        }
        p { margin: 12px 0; }
        ul, ol { margin: 12px 0; padding-left: 24px; }
        li { margin: 4px 0; }
        blockquote {
            border-left: 3px solid #4a90e2;
            margin: 16px 0;
            padding: 12px 20px;
            color: #555;
            font-style: italic;
            background: #f8f9fa;
            border-radius: 0 4px 4px 0;
        }
        pre {
            background: #f6f8fa;
            color: #24292e;
            padding: 16px;
            margin: 16px 0;
            border-radius: 6px;
            border: 1px solid #e1e4e8;
            overflow-x: auto;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 13px;
            line-height: 1.45;
            tab-size: 2;
        }
        code {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            background: #f6f8fa;
            color: #24292e;
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 13px;
        }
        pre code {
            background: transparent;
            padding: 0;
            border: none;
        }
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-justify { text-align: justify; }
        
        .hljs-keyword { color: #d73a49 !important; }
        .hljs-built_in { color: #6f42c1 !important; }
        .hljs-string { color: #032f62 !important; }
        .hljs-number { color: #005cc5 !important; }
        .hljs-comment { color: #6a737d !important; }
        .hljs-function { color: #6f42c1 !important; }
        .hljs-params { color: #24292e !important; }
        .hljs-title { color: #24292e !important; }
        .hljs-class { color: #6f42c1 !important; }
        .hljs-variable { color: #e36209 !important; }
    </style>
</head>
<body>
    ${content}
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof hljs !== 'undefined') {
                document.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
        });
    <\/script>
</body>
</html>`;
  
  const blob = new Blob([fullHTML], {type: 'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const cleanName = (metadata.title || 'document').toLowerCase().replace(/[^a-zа-я0-9]/g, '-').replace(/-+/g, '-');
  a.download = `${cleanName}.html`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}