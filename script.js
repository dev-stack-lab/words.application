let allWords = [], unlearnedWords = [], mistakeWords = [];
let favoriteIds = [];
let historyStack = [];
let forwardStack = [];
let isShuffle = false;
let questionMode = 'en-ja';

// 範囲設定の変数を管理
let currentRange = { start: 1, end: 100 };
let shuffledIds = [];
let currentIndex = 0;
let correctCount = 0;
let mistakeCount = 0;

const wordDisplay = document.getElementById('word-display');
const meaningDisplay = document.getElementById('meaning-display');
const favCountDisplay = document.getElementById('fav-count-display');
const wordListContainer = document.getElementById('word-list-container');
const resultScreen = document.getElementById('result-screen');
const modal = document.getElementById('help-modal');
const cardInner = document.getElementById('card-inner');
const mainCard = document.getElementById('main-card');
const buttonContainer = document.querySelector('.button-container');

// タブ制御
function switchView(targetId, btnId) {
    document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(targetId).classList.remove('hidden');
    document.getElementById(btnId).classList.add('active');
}

document.getElementById('tab-study').onclick = () => switchView('view-study', 'tab-study');
document.getElementById('tab-list').onclick = () => {
    switchView('view-list', 'tab-list');
    renderWordList();
};
document.getElementById('tab-settings').onclick = () => switchView('view-settings', 'tab-settings');

// 進捗表示の更新
function updateProgressDisplay() {
    document.getElementById('correct-count').textContent = correctCount;
    document.getElementById('incorrect-count').textContent = mistakeCount;
    document.getElementById('remaining-count').textContent = shuffledIds.length - currentIndex;
}

function saveProgress() {
    if (!window.currentProgressKey) return;

    const progress = {
        currentIndex: currentIndex,
        correctCount: correctCount,
        mistakeCount: mistakeCount,
        shuffledIds: shuffledIds,
        mistakeWords: mistakeWords,
        currentRange: currentRange,
        unlearnedWords: unlearnedWords,
        historyStack: historyStack,
        forwardStack: forwardStack
    };
    localStorage.setItem(window.currentProgressKey, JSON.stringify(progress));
}

function loadProgress() {
    if (!window.currentProgressKey) return false;

    const saved = localStorage.getItem(window.currentProgressKey);
    if (!saved) return false;
    
    try {
        const progress = JSON.parse(saved);
        
        currentRange = progress.currentRange || { start: 1, end: allWords.length };
        if(document.getElementById('start-range')) document.getElementById('start-range').value = currentRange.start;
        if(document.getElementById('end-range')) document.getElementById('end-range').value = currentRange.end;

        shuffledIds = progress.shuffledIds || [];
        currentIndex = progress.currentIndex || 0;
        correctCount = progress.correctCount || 0;
        mistakeCount = progress.mistakeCount || 0;
        mistakeWords = progress.mistakeWords || [];
        unlearnedWords = progress.unlearnedWords || [];
        historyStack = progress.historyStack || [];
        forwardStack = progress.forwardStack || [];

        if (shuffledIds && shuffledIds.length > 0 && currentIndex < shuffledIds.length) {
            updateProgressDisplay();
            const curId = shuffledIds[currentIndex];
            window.currentWord = allWords.find(w => w.id === curId);
            if (window.currentWord) {
                displayWord(window.currentWord);
                updateUndoButton();
                return true;
            }
        }
    } catch (e) {
        console.error("進捗の読み込みに失敗しました", e);
    }
    return false;
}

// 引数にファイル名とお気に入り用のキー名を受け取る
async function loadCSV(csvFile, favKey) {
    try {
        favoriteIds = JSON.parse(localStorage.getItem(favKey)) || [];
        window.currentFavKey = favKey;

        const res = await fetch(csvFile + '?t=' + Date.now());
        const txt = await res.text();
        allWords = txt.trim().split(/\r?\n/).map(line => {
            const p = line.split(/[,\t]/);
            if (p.length >= 2) return { id: parseInt(p[0]), word: p[1].trim(), meaning: p.slice(2).join(',').replace(/"/g, '').trim() };
            return null;
        }).filter(w => w && !isNaN(w.id));
        
        updateFavCount();
        loadSettings(); 

        if (!loadProgress()) {
            updateRange();
        }
    } catch (e) { wordDisplay.textContent = "CSVエラー"; }
}

function updateFavCount() { favCountDisplay.textContent = favoriteIds.length; }
function getStar(id) { return favoriteIds.includes(id) ? '★' : '☆'; }

function startSession(list) {
    unlearnedWords = [...list]; 
    mistakeWords = []; 
    historyStack = []; 
    forwardStack = [];
    
    isShuffle = document.getElementById('shuffle-toggle').checked;
    if (isShuffle) {
        unlearnedWords.sort(() => Math.random() - 0.5);
    }
    
    shuffledIds = unlearnedWords.map(w => w.id);
    currentIndex = 0;
    correctCount = 0;
    mistakeCount = 0;

    document.getElementById('correct-count').textContent = 0;
    document.getElementById('incorrect-count').textContent = 0;
    document.getElementById('remaining-count').textContent = unlearnedWords.length;
    resultScreen.classList.add('hidden');
    buttonContainer.classList.remove('hidden');
    updateUndoButton();
    nextWord();
}

function displayWord(wordObj) {
    if (!wordObj) return;
    window.currentWord = wordObj;
    document.getElementById('id-badge-front').textContent = `ID: ${wordObj.id}`;
    document.getElementById('id-badge-back').textContent = `ID: ${wordObj.id}`;
    
    const formattedMeaning = wordObj.meaning.replace(/／/g, '<br>');
    
    if (questionMode === 'en-ja') {
        wordDisplay.textContent = wordObj.word;
        meaningDisplay.innerHTML = formattedMeaning;
    } else {
        wordDisplay.innerHTML = formattedMeaning;
        meaningDisplay.textContent = wordObj.word;
    }

    const textLen = wordDisplay.textContent.length;
    if (textLen > 12) wordDisplay.style.fontSize = "1.8rem";
    else if (textLen > 8) wordDisplay.style.fontSize = "2.2rem";
    else wordDisplay.style.fontSize = "2.8rem";

    const isFav = favoriteIds.includes(wordObj.id);
    document.querySelectorAll('.fav-toggle-btn').forEach(btn => {
        btn.textContent = isFav ? '★' : '☆';
        btn.classList.toggle('active', isFav);
    });

    cardInner.classList.remove('is-flipped');
    document.getElementById('action-btn').textContent = "意味を表示";
}

function nextWord() {
    if (currentIndex >= shuffledIds.length && forwardStack.length === 0) { showResult(); return; }
    mainCard.classList.add('animate-next');
    setTimeout(() => {
        if (forwardStack.length > 0) {
            displayWord(forwardStack.pop());
        } else {
            const curId = shuffledIds[currentIndex];
            const wordObj = allWords.find(w => w.id === curId);
            displayWord(wordObj);
        }
        saveProgress();
    }, 120);
    setTimeout(() => mainCard.classList.remove('animate-next'), 300);
}

function showResult() {
    resultScreen.classList.remove('hidden');
    buttonContainer.classList.add('hidden');
    if (window.currentProgressKey) {
        localStorage.removeItem(window.currentProgressKey);
    }
    const mCount = mistakeWords.length;
    document.getElementById('mistake-count-final').textContent = mCount;
    const correct = document.getElementById('correct-count').textContent;
    const incorrect = document.getElementById('incorrect-count').textContent;
    document.getElementById('final-stats').textContent = `正解: ${correct} / 誤答: ${incorrect}`;
}

document.getElementById('fav-all-mistakes-btn').onclick = () => {
    let added = 0;
    mistakeWords.forEach(word => {
        if (!favoriteIds.includes(word.id)) { favoriteIds.push(word.id); added++; }
    });
    if (added > 0) {
        localStorage.setItem(window.currentFavKey, JSON.stringify(favoriteIds));
        updateFavCount();
        alert(`${added}件を登録しました。`);
    }
};

function toggleMeaning() {
    if (!resultScreen.classList.contains('hidden')) return;
    const isFlipped = cardInner.classList.contains('is-flipped');
    cardInner.classList.toggle('is-flipped');
    document.getElementById('action-btn').textContent = isFlipped ? "意味を表示" : "意味を隠す";
}

cardInner.onclick = (e) => {
    if (!e.target.closest('.fav-toggle-btn')) {
        toggleMeaning();
    }
};
document.getElementById('action-btn').onclick = toggleMeaning;

function judge(isCorrect) {
    if (!resultScreen.classList.contains('hidden') || !window.currentWord) return;
    historyStack.push({
        word: window.currentWord,
        wasCorrect: isCorrect,
        correctCount: correctCount,
        mistakeCount: mistakeCount,
        currentIndex: currentIndex
    });
    if (isCorrect) {
        correctCount++;
    } else {
        mistakeCount++;
        mistakeWords.push(window.currentWord);
    }
    
    unlearnedWords = unlearnedWords.filter(w => w.id !== window.currentWord.id);
    currentIndex++;
    
    updateProgressDisplay();
    updateUndoButton();
    nextWord();
}

function undo() {
    if (historyStack.length === 0) return;
    forwardStack.push(window.currentWord);
    const last = historyStack.pop();
    
    correctCount = last.correctCount;
    mistakeCount = last.mistakeCount;
    currentIndex = last.currentIndex;
    
    if (!unlearnedWords.find(w => w.id === last.word.id)) unlearnedWords.push(last.word);
    if (!last.wasCorrect) mistakeWords.pop();
    
    updateProgressDisplay();
    displayWord(last.word);
    updateUndoButton();
    saveProgress();
}

function updateUndoButton() {
    const btn = document.getElementById('undo-btn');
    if (btn) btn.disabled = (historyStack.length === 0);
}

document.getElementById('correct-btn').onclick = () => judge(true);
document.getElementById('incorrect-btn').onclick = () => judge(false);
document.getElementById('undo-btn').onclick = undo;
document.getElementById('set-range-btn').onclick = updateRange;
document.getElementById('restart-btn').onclick = () => updateRange();
document.getElementById('retry-mistakes-btn').onclick = () => startSession(mistakeWords);

function updateRange() {
    let targetWords = [];
    const weekSelect = document.getElementById('kikutan-week-select');
    const currentMaterial = localStorage.getItem('selected_material_key');

    if (currentMaterial === 'kikutan' && weekSelect && weekSelect.value !== 'all') {
        const weekNum = parseInt(weekSelect.value);
        const startId = (weekNum - 1) * 112 + 1;
        const endId = weekNum * 112;
        
        if (document.getElementById('start-range')) document.getElementById('start-range').value = startId;
        if (document.getElementById('end-range')) document.getElementById('end-range').value = endId;
        
        currentRange = { start: startId, end: endId };
        targetWords = allWords.filter(w => w.id >= startId && w.id <= endId);
    } else {
        const s = parseInt(document.getElementById('start-range').value);
        const e = parseInt(document.getElementById('end-range').value);
        currentRange = { start: s, end: e };
        targetWords = allWords.filter(w => w.id >= s && w.id <= e);
    }
    
    isShuffle = document.getElementById('shuffle-toggle').checked;
    if (isShuffle) {
        targetWords.sort(() => Math.random() - 0.5);
    }
    
    unlearnedWords = [...targetWords];
    shuffledIds = unlearnedWords.map(w => w.id);
    currentIndex = 0;
    correctCount = 0;
    mistakeCount = 0;
    mistakeWords = [];
    historyStack = [];
    forwardStack = [];

    updateProgressDisplay();
    resultScreen.classList.add('hidden');
    buttonContainer.classList.remove('hidden');
    updateUndoButton();
    
    if (shuffledIds.length > 0) {
        const curId = shuffledIds[currentIndex];
        window.currentWord = allWords.find(w => w.id === curId);
        displayWord(window.currentWord);
        saveProgress();
    } else {
        wordDisplay.textContent = "範囲外です";
        meaningDisplay.textContent = "";
    }
}

window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || !resultScreen.classList.contains('hidden')) return;
    if (e.code === 'Space') { e.preventDefault(); toggleMeaning(); } 
    else if (e.code === 'Enter') { judge(true); }
});

function toggleFav(id) {
    if (favoriteIds.includes(id)) favoriteIds = favoriteIds.filter(i => i !== id);
    else favoriteIds.push(id);
    localStorage.setItem(window.currentFavKey, JSON.stringify(favoriteIds));
    updateFavCount();
    
    const isFav = favoriteIds.includes(id);
    document.querySelectorAll('.fav-toggle-btn').forEach(btn => {
        btn.textContent = isFav ? '★' : '☆';
        btn.classList.toggle('active', isFav);
    });
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.fav-toggle-btn');
    if (btn) {
        e.stopPropagation(); 
        e.preventDefault();
        toggleFav(window.currentWord.id);
    }
});

document.getElementById('load-favorites-btn').onclick = () => {
    const favs = allWords.filter(w => favoriteIds.includes(w.id));
    if (favs.length > 0) startSession(favs);
    else alert("お気に入り登録がありません。");
};

document.getElementById('load-range-favorites-btn').onclick = () => {
    const s = parseInt(document.getElementById('start-range').value);
    const e = parseInt(document.getElementById('end-range').value);

    const rangeFavs = allWords.filter(w => w.id >= s && w.id <= e && favoriteIds.includes(w.id));
    
    if (rangeFavs.length > 0) {
        currentRange = { start: s, end: e };
        startSession(rangeFavs);
    } else {
        alert("指定された範囲内にお気に入り登録された単語がありません。");
    }
};

document.getElementById('shuffle-toggle').onchange = (e) => { 
    isShuffle = e.target.checked; 
    saveSettings();
};
document.getElementById('question-mode').onchange = (e) => { 
    questionMode = e.target.value; 
    if(window.currentWord) displayWord(window.currentWord);
};
// すべてのお気に入りを解除
const clearFavsBtn = document.getElementById('clear-all-favs-btn');
if (clearFavsBtn) {
    clearFavsBtn.onclick = () => {
        if(confirm("すべてのお気に入りを解除しますか？")) {
            favoriteIds = [];
            localStorage.setItem(window.currentFavKey, JSON.stringify(favoriteIds));
            updateFavCount();
            alert("解除しました。");
            if(window.currentWord) displayWord(window.currentWord);
        }
    };
}

// 指定範囲内のお気に入りのみ解除
const clearRangeFavsBtn = document.getElementById('clear-range-favs-btn');
if (clearRangeFavsBtn) {
    clearRangeFavsBtn.onclick = () => {
        const sEl = document.getElementById('start-range');
        const eEl = document.getElementById('end-range');
        const s = sEl ? parseInt(sEl.value) : 1;
        const e = eEl ? parseInt(eEl.value) : 100;

        // 範囲内のIDリストを取得
        const targetIds = allWords
            .filter(w => w.id >= s && w.id <= e)
            .map(w => w.id);

        // 範囲内で現在お気に入りに登録されているものを確認
        const targetsInFav = favoriteIds.filter(id => targetIds.includes(id));

        if (targetsInFav.length === 0) {
            alert(`範囲（ID: ${s} 〜 ${e}）内にお気に入り登録された単語はありません。`);
            return;
        }

        if (confirm(`範囲（ID: ${s} 〜 ${e}）内の単語のお気に入り（${targetsInFav.length}件）を解除しますか？`)) {
            // 対象範囲外のIDを残す
            favoriteIds = favoriteIds.filter(id => !targetIds.includes(id));
            
            localStorage.setItem(window.currentFavKey, JSON.stringify(favoriteIds));
            updateFavCount();
            alert("指定範囲のお気に入りを解除しました。");
            
            if (window.currentWord) displayWord(window.currentWord);
        }
    };
}

function renderWordList() {
    const term = document.getElementById('list-search').value.toLowerCase().trim();
    const activeFilter = document.querySelector('.filter-btn.active').id; 
    wordListContainer.innerHTML = '';
    
    allWords.filter(w => {
        const m = w.word.toLowerCase().includes(term) || w.meaning.toLowerCase().includes(term) || w.id.toString().includes(term);
        const isFav = favoriteIds.includes(w.id);
        
        if (!m) return false;
        if (activeFilter === 'filter-fav') return isFav;      
        if (activeFilter === 'filter-non-fav') return !isFav;  
        return true; 
    }).forEach(w => {
        const isFav = favoriteIds.includes(w.id);
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `<button class="list-fav-btn ${isFav?'active':''}" onclick="handleListFav(${w.id}, this)">${isFav?'★':'☆'}</button>
            <span class="list-id">${w.id}</span>
            <div class="list-info"><span class="list-word">${w.word}</span><span class="list-meaning">${w.meaning}</span></div>`;
        wordListContainer.appendChild(div);
    });
}

document.getElementById('list-search').oninput = renderWordList;

function switchFilter(btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderWordList();
}

document.getElementById('filter-all').onclick = function() { switchFilter(this); };
document.getElementById('filter-fav').onclick = function() { switchFilter(this); };
document.getElementById('filter-non-fav').onclick = function() { switchFilter(this); };

window.handleListFav = (id, btn) => { 
    toggleFav(id); 
    btn.textContent = getStar(id); 
    btn.classList.toggle('active'); 
    const activeId = document.querySelector('.filter-btn.active').id;
    if (activeId !== 'filter-all') renderWordList(); 
};

document.getElementById('help-open-btn').onclick = () => modal.classList.add('active');
const hideM = () => { modal.classList.remove('active'); document.getElementById('help-tab-guide').click(); };
document.getElementById('help-close-btn').onclick = hideM;
document.getElementById('help-close-icon').onclick = hideM;
window.onclick = (e) => { if(e.target == modal) hideM(); };

const tG = document.getElementById('help-tab-guide'), tU = document.getElementById('help-tab-update');
const cG = document.getElementById('help-guide-content'), cU = document.getElementById('help-update-content');
if (tG) {
    tG.onclick = () => { tG.classList.add('active'); tU.classList.remove('active'); cG.classList.remove('hidden'); cU.classList.add('hidden'); };
    tU.onclick = () => { tU.classList.add('active'); tG.classList.remove('active'); cU.classList.remove('hidden'); cG.classList.add('hidden'); };
}

const darkToggleSettings = document.getElementById('dark-mode-toggle-settings');
function updateDarkModeUI(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    darkToggleSettings.textContent = isDark ? '☀️ ライトモード' : '🌙 ダークモード';
    localStorage.setItem('dark_mode', isDark ? 'enabled' : 'disabled');
}
if (localStorage.getItem('dark_mode') === 'enabled') updateDarkModeUI(true);
darkToggleSettings.onclick = () => updateDarkModeUI(!document.body.classList.contains('dark-mode'));

function saveSettings() {
    const settings = { isShuffle, questionMode };
    localStorage.setItem('app_settings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('app_settings');
    const toggleEl = document.getElementById('shuffle-toggle');
    const modeEl = document.getElementById('question-mode');

    if (saved) {
        const settings = JSON.parse(saved);
        isShuffle = settings.isShuffle;
        questionMode = settings.questionMode;
        
        if (toggleEl) toggleEl.checked = isShuffle;
        if (modeEl) modeEl.value = questionMode;
    } else {
        if (toggleEl) isShuffle = toggleEl.checked;
        if (modeEl) questionMode = modeEl.value;
    }
}

// 初期化設定：教材選択画面を表示
document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
document.getElementById('view-select-material').classList.remove('hidden');
document.querySelector('.tab-menu').classList.add('hidden'); 

// 教材変更ボタンが押されたときの処理
document.getElementById('tab-back-to-menu').onclick = () => {
    document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
    document.querySelector('.tab-menu').classList.add('hidden');
    document.getElementById('view-select-material').classList.remove('hidden');
};

// 教材カードボタンが押されたときの処理（単一化・Week表示制御付き）
document.querySelectorAll('.material-card-btn').forEach(btn => {
    btn.onclick = () => {
        const material = btn.getAttribute('data-material');
        
        localStorage.setItem('selected_material_key', material);
        
        document.getElementById('view-select-material').classList.add('hidden');
        document.getElementById('view-study').classList.remove('hidden');
        document.querySelector('.tab-menu').classList.remove('hidden');
        
        document.getElementById('result-screen').classList.add('hidden');
        document.querySelector('.button-container').classList.remove('hidden');
        
        let csvFile = '';
        let favKey = '';
        let progressKey = '';

        // キクタン専用メニューの表示・非表示制御
        const weekContainer = document.getElementById('kikutan-week-container');
        if (weekContainer) {
            if (material === 'kikutan') {
                weekContainer.classList.remove('hidden');
                weekContainer.style.display = 'flex';
            } else {
                weekContainer.classList.add('hidden');
                weekContainer.style.display = 'none';
            }
        }

        if (material === 'shistan') {
            csvFile = 'english_only.csv';
            favKey = 'fav_ids_shistan';
            progressKey = 'progress_shistan';
        } else if (material === 'kobun') {
            csvFile = 'words.1.csv';
            favKey = 'fav_ids_kobun';
            progressKey = 'progress_kobun';
        } else if (material === 'ex1') {
            csvFile = 'eitangoex.csv';
            favKey = 'fav_ids_ex1';
            progressKey = 'progress_ex1';
        } else if (material === 'kikutan') {
            csvFile = 'kikutansuper.csv';
            favKey = 'fav_ids_kikutan';
            progressKey = 'progress_kikutan';
        } else if (material === 'eijukugo') {
            csvFile = 'eijukugo.csv';
            favKey = 'fav_ids_eijukugo';
            progressKey = 'progress_eijukugo';
        }

        window.currentProgressKey = progressKey;
        loadCSV(csvFile, favKey);
    };
});
// ハンバーガーメニュー制御および個数指定学習処理
document.addEventListener('DOMContentLoaded', () => {
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const menuCloseBtn = document.getElementById('menu-close-btn');
    const menuOverlay = document.getElementById('menu-overlay');
    const sideMenu = document.getElementById('side-menu');

    function openSideMenu() {
        sideMenu?.classList.add('active');
        menuOverlay?.classList.add('active');
    }

    function closeSideMenu() {
        sideMenu?.classList.remove('active');
        menuOverlay?.classList.remove('active');
    }

    if (menuToggleBtn) menuToggleBtn.onclick = openSideMenu;
    if (menuCloseBtn) menuCloseBtn.onclick = closeSideMenu;
    if (menuOverlay) menuOverlay.onclick = closeSideMenu;

    // サイドメニュー内のボタンを押したら閉じる
    document.querySelectorAll('.tab-menu-vertical .tab-btn').forEach(btn => {
        btn.addEventListener('click', closeSideMenu);
    });

    // お気に入り個数指定学習
    const loadFavCountBtn = document.getElementById('load-fav-count-btn');
    if (loadFavCountBtn) {
        loadFavCountBtn.onclick = () => {
            const countInput = document.getElementById('fav-study-count-input');
            const requestedCount = countInput ? parseInt(countInput.value) : 10;

            if (isNaN(requestedCount) || requestedCount <= 0) {
                alert("1以上の正の数値を入力してください。");
                return;
            }

            // allWords と favoriteIds が定義されていることを確認
            if (typeof allWords === 'undefined' || typeof favoriteIds === 'undefined') {
                return;
            }

            const favWords = allWords.filter(w => favoriteIds.includes(w.id));

            if (favWords.length === 0) {
                alert("お気に入り登録されている単語がありません。");
                return;
            }

            const shuffledFavs = [...favWords].sort(() => Math.random() - 0.5);
            const targetWords = shuffledFavs.slice(0, Math.min(requestedCount, favWords.length));

            if (requestedCount > favWords.length) {
                alert(`お気に入りが${favWords.length}件しかないため、全${favWords.length}件で学習を開始します。`);
            }

            if (typeof startSession === 'function') {
                startSession(targetWords);
            }
        };
    }
});
// 教材選択ボタンが押されたときの処理にメニューのアクティブ状態更新を追加
document.querySelectorAll('.material-card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // メニューのタブ選択状態を「学習する」に更新
        document.querySelectorAll('.tab-menu .tab-btn').forEach(tab => tab.classList.remove('active'));
        const studyTab = document.getElementById('tab-study');
        if (studyTab) {
            studyTab.classList.add('active');
        }
    });
});
// メニュー内のタブ切り替え時にアクティブ表示を正しく更新する処理
document.querySelectorAll('.tab-menu .tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-menu .tab-btn').forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const listSearchInput = document.getElementById('list-search');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    if (listSearchInput && clearSearchBtn) {
        // 入力状況に応じて「×ボタン」の表示/非表示を切り替え
        listSearchInput.addEventListener('input', () => {
            if (listSearchInput.value.length > 0) {
                clearSearchBtn.classList.remove('hidden');
            } else {
                clearSearchBtn.classList.add('hidden');
            }
        });

        // 「×ボタン」を押した時の処理（文字クリア＆一覧更新）
        clearSearchBtn.addEventListener('click', () => {
            listSearchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            listSearchInput.focus();

            // 一覧の再描画関数（プロジェクト内の検索処理イベントを発火）
            listSearchInput.dispatchEvent(new Event('input'));
        });
    }
});
