// ===== 字库：年级 + 课次（数据来自 hanzilist.csv，见 js/hanzilist.js） =====
const ALL_KEY = 'ALL';
const STORAGE_KEY = 'hanzibomb.selection';

let GRADES = {};              // { 年级: { 课次: [{ char, pinyin }] } }
let GLOBAL_DICTIONARY = [];   // 所有年级的字（用于补充干扰项）

const gradeSelect = document.getElementById('grade-select');
const lessonSelect = document.getElementById('lesson-select');
const startLessonName = document.getElementById('start-lesson-name');
const startWordCount = document.getElementById('start-word-count');
const targetScoreDisplay = document.getElementById('target-score');
const startBtn = document.getElementById('start-btn');

function addOption(select, value, text) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.innerText = text;
  select.appendChild(opt);
}

function hasOption(select, value) {
  return [...select.options].some(o => o.value === value);
}

function saveSelection() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ grade: gradeSelect.value, lesson: lessonSelect.value }));
  } catch (e) { /* 忽略 */ }
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
}

// 读取字库并初始化年级、课次下拉菜单
async function initSelectors() {
  try {
    GRADES = await loadHanziList();
  } catch (err) {
    GRADES = {};
    startLessonName.innerText = hanziListErrorMessage(err);
    startLessonName.style.fontSize = '16px';
    startBtn.disabled = true;
    return;
  }
  GLOBAL_DICTIONARY = allWords(GRADES);

  for (const grade in GRADES) addOption(gradeSelect, grade, grade);

  const saved = loadSaved();
  if (saved.grade && hasOption(gradeSelect, saved.grade)) gradeSelect.value = saved.grade;
  fillLessonOptions();
  if (saved.lesson && hasOption(lessonSelect, saved.lesson)) lessonSelect.value = saved.lesson;

  updateStartScreenInfo();
}

function fillLessonOptions() {
  const grade = gradeSelect.value;
  lessonSelect.innerHTML = '';
  addOption(lessonSelect, ALL_KEY, `整个${grade}`);
  for (const lesson in (GRADES[grade] || {})) addOption(lessonSelect, lesson, lesson);
}

function updateStartScreenInfo() {
  const grade = gradeSelect.value;
  const selected = lessonSelect.value;
  saveSelection();
  if (selected === ALL_KEY) {
    startLessonName.innerText = `整个${grade}`;
  } else {
    startLessonName.innerText = `${grade} · ${selected}`;
  }
  startWordCount.innerText = `（共 ${getCurrentDictionary().length} 字）`;
}

function changeGrade() {
  fillLessonOptions();
  changeLesson();
}

function changeLesson() {
  updateStartScreenInfo();
  // 如果游戏正在进行中，退出到结算/开始重新启动
  if (gameActive) {
    quitGame();
  }
}

// 获取当前选中的字表
function getCurrentDictionary() {
  const grade = gradeSelect.value;
  const val = lessonSelect.value;
  if (val === ALL_KEY) return gradeWords(GRADES, grade);
  return (GRADES[grade] || {})[val] || [];
}

let lives, score, gameActive = false, activeBombs = [], targetChar, animationFrameId;
let questionPool = []; 
let wrongStreak = 0;
let currentDictionary = [];
const WIN_SCORE = 20;

const container = document.getElementById('game-container');
const pinyinDisplay = document.getElementById('pinyin-display');
const livesDisplay = document.getElementById('lives');
const scoreDisplay = document.getElementById('score');
const speedInput = document.getElementById('speed');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const gameOverTitle = document.getElementById('game-over-title');
const finalScoreDisplay = document.getElementById('final-score');

// 洗牌机制：打乱题库，确保抽完一整轮前不重复
function resetQuestionPool() {
  questionPool = [...currentDictionary].sort(() => Math.random() - 0.5);
}

function startGame() {
  currentDictionary = getCurrentDictionary();
  if (!currentDictionary || currentDictionary.length === 0) return;

  lives = 10;
  score = 0;
  gameActive = true;
  activeBombs = [];
  wrongStreak = 0;
  resetQuestionPool();
  
  livesDisplay.innerText = lives;
  scoreDisplay.innerText = score;
  targetScoreDisplay.innerText = WIN_SCORE;
  startScreen.style.display = 'none';
  gameOverScreen.style.display = 'none';
  
  document.querySelectorAll('.bomb').forEach(el => el.remove());
  
  spawnWave();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  gameLoop();
}

function spawnWave() {
  activeBombs.forEach(b => b.element.remove());
  activeBombs = [];
  wrongStreak = 0;

  // 题库用完后重新洗牌循环
  if (questionPool.length === 0) {
    resetQuestionPool();
  }

  const targetObj = questionPool.pop();
  targetChar = targetObj.char;
  pinyinDisplay.innerText = targetObj.pinyin;

  let choices = [targetObj];
  let usedPinyins = new Set([targetObj.pinyin.toLowerCase()]);
  let usedChars = new Set([targetObj.char]);

  // 干扰项机制：优先从当前课次选择不同拼音的生字
  let candidateList = currentDictionary
    .filter(item => item.pinyin.toLowerCase() !== targetObj.pinyin.toLowerCase() && !usedChars.has(item.char))
    .sort(() => Math.random() - 0.5);

  for (let cand of candidateList) {
    const candPinyin = cand.pinyin.toLowerCase();
    if (!usedPinyins.has(candPinyin)) {
      choices.push(cand);
      usedPinyins.add(candPinyin);
      usedChars.add(cand.char);
    }
    if (choices.length === 4) break;
  }

  // 如果当前课次字数少于4个互不重读音的字，从全局字表补充干扰项
  if (choices.length < 4) {
    let globalCandidates = GLOBAL_DICTIONARY
      .filter(item => !usedPinyins.has(item.pinyin.toLowerCase()) && !usedChars.has(item.char))
      .sort(() => Math.random() - 0.5);
    for (let cand of globalCandidates) {
      const candPinyin = cand.pinyin.toLowerCase();
      if (!usedPinyins.has(candPinyin)) {
        choices.push(cand);
        usedPinyins.add(candPinyin);
        usedChars.add(cand.char);
      }
      if (choices.length === 4) break;
    }
  }

  choices.sort(() => Math.random() - 0.5);

  const columns = container.offsetWidth / choices.length;
  choices.forEach((choice, index) => {
    const bombEl = document.createElement('div');
    bombEl.className = 'bomb';
    bombEl.innerText = choice.char;
    
    const randomOffsetX = Math.random() * (columns - 80);
    const xPos = (index * columns) + Math.max(10, randomOffsetX);
    const yPos = -80 - (Math.random() * 80); 

    bombEl.style.left = xPos + 'px';
    bombEl.style.top = yPos + 'px';

    bombEl.onmousedown = () => handleBombClick(choice.char, bombEl);

    container.appendChild(bombEl);

    activeBombs.push({
      element: bombEl,
      char: choice.char,
      y: yPos,
      exploded: false
    });
  });
}

function handleBombClick(char, element) {
  if (!gameActive) return;

  if (char === targetChar) {
    wrongStreak = 0;
    score++;
    scoreDisplay.innerText = score;
    
    if (score >= WIN_SCORE) {
      endScreen('win');
    } else {
      spawnWave();
    }
  } else {
    wrongStreak++;
    element.style.backgroundColor = '#d9534f'; 
    setTimeout(() => { 
      if (element) element.style.backgroundColor = '#2c3e50'; 
    }, 200);

    // 连错两次直接扣血并重新出题
    if (wrongStreak >= 2) {
      activeBombs.forEach(b => explode(b));
      handleDamage();
    }
  }
}

function gameLoop() {
  if (!gameActive) return;

  const speed = parseFloat(speedInput.value);
  let targetReachedFloor = false;
  const floorLevel = container.offsetHeight - 70;

  activeBombs.forEach(bomb => {
    if (bomb.exploded) return;
    
    bomb.y += speed;
    bomb.element.style.top = bomb.y + 'px';

    if (bomb.y >= floorLevel) {
      if (bomb.char === targetChar) {
        targetReachedFloor = true;
        explode(bomb);
      } else {
        bomb.element.style.display = 'none';
      }
    }
  });

  if (targetReachedFloor) {
    handleDamage();
    return;
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

function explode(bomb) {
  bomb.exploded = true;
  bomb.element.className = 'bomb explosion';
  bomb.element.innerText = '💥';
}

function handleDamage() {
  lives--;
  livesDisplay.innerText = lives;
  gameActive = false;

  if (lives <= 0) {
    setTimeout(() => {
      endScreen('lose');
    }, 800);
  } else {
    setTimeout(() => {
      gameActive = true;
      spawnWave();
      gameLoop();
    }, 1200);
  }
}

function quitGame() {
  if (!gameActive) return;
  endScreen('quit');
}

function endScreen(status) {
  gameActive = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  if (status === 'win') {
    gameOverTitle.innerText = "胜利! 🎉";
    gameOverTitle.style.color = "#4CAF50";
  } else if (status === 'lose') {
    gameOverTitle.innerText = "失败! 💥";
    gameOverTitle.style.color = "#ffeb3b";
  } else if (status === 'quit') {
    gameOverTitle.innerText = "下次再来! 👋";
    gameOverTitle.style.color = "#ffffff";
  }

  finalScoreDisplay.innerText = score + " / " + WIN_SCORE;
  gameOverScreen.style.display = 'flex';
}

// 初始化
initSelectors();
