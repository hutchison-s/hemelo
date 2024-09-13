const $id = (sel) => document.getElementById(sel);
const $arr = (sel) => Array.from(document.querySelectorAll(sel))

class Touch {
    constructor (idx, previous=null) {
        this.value = idx;
        this.time = Date.now();
        this.elapsedTime = previous ? (this.time - previous.time) : 0;
    }
}

class Pattern {
    constructor(length) {
        this.max = length;
        this.touches = [];
    }
    static generateRandom(length, isEasy=false) {
        const pat = new Pattern(length)
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * 4);
            pat.insert(randomIndex);
            if (i !== 0) {
                const multiple = Math.ceil(Math.random() * 2);
                pat.touches[i].elapsedTime = isEasy ? 600 : multiple * 350;
            }
        }
        return pat;
    }
    get totalTime() {
        return this.touches.reduce((acc,val)=>acc+val.elapsedTime, 0);
    }
    get size() {
        return this.touches.length;
    }
    insert(idx) {
        if (this.touches.length >= this.max) {
            throw new Error('Cannot add another touch to this pattern. Maximum length of '+this.max+'.');
        }
        if (this.size === 0) {
            const newTouch = new Touch(idx);
            this.start_time = newTouch.time;
            this.touches.push(newTouch)
        } else {
            const newTouch = new Touch(idx, this.touches[this.touches.length - 1]);
            this.touches.push(newTouch);
        }
    }
    equals(other, isEasy) {
        if (!(other instanceof Pattern)) {
            console.error('not a pattern');
            return false;
        }
        const maxIndex = this.touches.length
        for (let i = 0; i < maxIndex; i++) {
            const x = this.touches[i];
            const y = other.touches[i];
            const delta = Math.abs(x.elapsedTime - y.elapsedTime);
            if (x.value !== y.value) {
                return false;
            } else if (!isEasy && delta > 300) {
                return false;
            }
        }
        return true;
    }
    play(callback) {
        let timeSum = 0;
        for (const touch of this.touches) {
            timeSum += touch.elapsedTime;
            setTimeout(()=>callback(touch.value), timeSum);
        }
    }
    clear() {
        this.touches.length = 0;
    }
}

class Game {
    constructor(modeBtns, scoreList, levelCounter, wheel, colors, display, button) {
        this.speed = 350;
        this.level = 3;
        this.isPaused = true;
        this.truePattern = Pattern.generateRandom(this.level);
        this.userPattern = new Pattern(this.level);
        this.ui = new GameUI(modeBtns, scoreList, levelCounter, wheel, colors, display, button);
        this.audio = new GameAudio();
        this.scores = null;
        this.mode = 'normal';
        this.initialize();
    }

    async initialize() {
        this.scores = await this.fetchScores();
        this.ui.highScores = this.scores;

        for (const [idx, c] of this.ui.colors.entries()) {
            c.addEventListener('pointerdown', ()=>{
                c.classList.add('active')
            })
            c.addEventListener('pointerup', ()=>{
                c.classList.remove('active')
            })
            c.addEventListener('click', (e)=>this.evaluateTouch(e, idx))
        }
        for (const b of this.ui.modeBtns) {
            b.addEventListener('change', (e)=>{
                if (e.target.checked) {
                    this.mode = e.target.value;
                    if (this.mode === 'easy') {
                        alert('High scores will not be saved in easy mode.')
                    }
                    this.reset();                    
                }
            })
        }

        this.ui.button.addEventListener('click', ()=>{            
            this.newPattern()
        });

    }
    newPattern() {
        if (this.audio.actx === null) {
            this.audio.createContext();
        }
        this.ui.disableButton()
        this.ui.displayText = 'Pay attention...'
        this.truePattern = Pattern.generateRandom(this.level, this.mode === 'easy');
        if (this.mode === 'hard') {
            this.ui.hideWheel();
        }
        this.truePattern.play(this.playTouch.bind(this))
        setTimeout(()=>{
            this.ui.displayText = 'Go ahead...'
            this.isPaused = false;
            if (this.mode === 'hard') {
                this.ui.showWheel();
            }
        }, this.truePattern.totalTime + 500)
    }
    playTouch(idx) {
        this.ui.highlightColor(idx)
        this.audio.produceTone(idx)
    }
    isCorrectPattern() {
        return this.truePattern.equals(this.userPattern, this.mode === 'easy')
    }
    evaluateTouch(e, idx) {
        if (this.isPaused) return;
        this.userPattern.insert(idx);
        this.audio.produceTone(idx)
        if (this.userPattern.size === this.level) {
            this.evaluatePattern()
        }
    }
    evaluatePattern() {
        if (this.isCorrectPattern()) {
            this.handleCorrectPattern();
        } else {
            this.handleWrongPattern();
        }
    }
    async handleWrongPattern() {
        this.ui.displayText = 'Not Quite!'
        this.ui.disableWheel();
        this.isPaused = true;
        await this.updateScores();
        setTimeout(()=>{
            this.reset();
            this.truePattern.play(this.playTouch.bind(this))
            this.ui.highScores = this.scores;
        }, 1000)
    }
    handleCorrectPattern() {
        this.isPaused = true;
        this.ui.displayText = 'Correct!'
        setTimeout(this.advance.bind(this), 1000)
    }
    advance() {
        this.level++;
        this.userPattern.clear();
        this.userPattern.max = this.level;
        this.ui.refresh(this.level);
        this.ui.displayText = 'On to the next!'
    }
    reset() {
        this.level = 3;
        this.userPattern.clear();
        this.userPattern.max = this.level;
        setTimeout(()=>{
            this.ui.refresh(this.level);
            this.ui.displayText = 'Ready?';
        }, this.truePattern.totalTime + 1000)
    }
    getInitials() {
        const userInput = prompt('Enter your full name (eg. "Patrick Lavon Mahomes")');
        if (!userInput) {
            return {name: 'Anon', initials: 'Anon'}
        }
        const names = userInput.trim().split(" ").slice(0, 3);
        const initials = names.map(name => name[0].toUpperCase()).join("")
        return {name: userInput.trim().substring(0, 35), initials};
    }
    async fetchScores() {
        const scores = await fetch('https://hemelo.vercel.app/scores');
        const json = await scores.json();
        return json.scores
    }
    async updateScores() {
        if (this.mode === 'easy') return;

        let newScores;
        const hasFewerScores = this.scores.length < 10;
        const isHigherScore = this.scores.some(score => score.score < this.level - 2)

        if (hasFewerScores || isHigherScore) {
            const {name, initials} = this.getInitials()
            newScores = await this.postScore(name, initials);
        } else {
            newScores = await this.fetchScores();
        }
        for (let i = 0; i < newScores.length; i++) {
            this.scores[i] = newScores[i];
        }
    }
    async postScore(name, initials) {
        const updated = await fetch('https://hemelo.vercel.app/scores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({name, initials, score: this.level - 2, mode: this.mode})
        })
        const json = await updated.json();
        return json.scores;
    }
}

class GameUI {
    constructor(modeBtns, scoreList, levelCounter, wheel, colors, display, button) {
        this.scoreList = scoreList;
        this.levelCounter = levelCounter;
        this.wheel = wheel;
        this.colors = colors;
        this.display = display;
        this.button = button;
        this.modeBtns = modeBtns;
    }
    disableButton() {
        this.button.setAttribute('disabled', true)
    }
    enableButton() {
        this.button.removeAttribute('disabled')
    }
    hideWheel() {
        this.wheel.classList.add('hidden')
    }
    showWheel() {
        this.wheel.classList.remove('hidden')
    }
    disableWheel() {
        this.wheel.classList.add('failed')
    }
    enableWheel() {
        this.wheel.classList.remove('failed')
    }
    highlightColor(idx) {
        const quadrant = this.colors[idx]
        quadrant.classList.add('active')
        setTimeout(()=>{
            quadrant.classList.remove('active')
        }, 150)
    }
    refresh(level) {
        this.levelDisplay = level;
        this.enableWheel();
        this.enableButton();
    }
    set levelDisplay(n) {
        this.levelCounter.textContent = n - 2;
    }
    set displayText(text) {
        this.display.textContent = text;
    }
    set highScores(array) {
        if (array[0] === 'No scores recorded yet') {
            return;
        }
        this.scoreList.innerHTML = ''
        for (const [idx, score] of array.entries()) {
            this.scoreList.innerHTML += `<li>${idx+1}. ${score.initials} - Level ${score.score}${score.hardMode ? ' *' : ''}</li>`
        }
    }
}

class GameAudio {
    constructor() {
        this.frequencies = [261.6, 311.1, 349.2, 392];
        this.actx = null;
    }
    createContext() {
        this.actx = new AudioContext();
    }
    produceTone(idx) {
        const osc = this.actx.createOscillator();
        const gain = this.actx.createGain();
        osc.connect(gain);
        gain.connect(this.actx.destination)
        gain.gain.setValueAtTime(0, this.actx.currentTime);
        osc.start();
        const now = this.actx.currentTime;
        osc.frequency.value = this.frequencies[idx];
        gain.gain.linearRampToValueAtTime(0.9, now + 0.05);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.stop(now + 0.5);
    }
}

const colors = [
    $id('Red'),
    $id('Green'),
    $id('Purple'),
    $id('Blue'),
]
const levelCounter = $id('level');
const wheel = $id('wheel')
const display = $id('instructions');
const startBtn = $id('begin');
const scoresBtn = $id('menuToggle');
const scores = $id('highScores');
const scoreList = $id('scoreList');
const closeScoresBtn = $id('closeModal');
const modeBtns = $arr('input[name="mode"]');

scoresBtn.addEventListener('click', ()=>{
    scores.showModal();
})

closeScoresBtn.addEventListener('click', ()=>{
    scores.close();
})

const game = new Game(modeBtns, scoreList, levelCounter, wheel, colors, display, startBtn);


