const STORAGE_KEY = "synonymQuestWords";
const starterWords = [
  {word:"happy", synonym:"joyful"}, {word:"big", synonym:"large"},
  {word:"small", synonym:"tiny"}, {word:"beautiful", synonym:"gorgeous"},
  {word:"smart", synonym:"clever"}, {word:"fast", synonym:"quick"},
  {word:"angry", synonym:"furious"}, {word:"begin", synonym:"start"},
  {word:"end", synonym:"finish"}, {word:"important", synonym:"essential"},
  {word:"brave", synonym:"courageous"}, {word:"easy", synonym:"simple"}
];
let words = loadWords();
let soundOn = true;
let gameState = {};

const $ = id => document.getElementById(id);
const wordForm = $("wordForm");
const wordList = $("wordList");
const playArea = $("playArea");
const stage = $("gameStage");

function loadWords(){
  try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(data) ? data : [...starterWords]; }
  catch { return [...starterWords]; }
}
function saveWords(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(words)); renderWords(); }
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function renderWords(){
  $("wordCount").textContent = `${words.length} ta so‘z juftligi`;
  $("wordStatus").textContent = words.length ? `${words.length} ta juftlik tayyor. O‘yinlar shu ro‘yxat asosida tuziladi.` : "Hozircha so‘z yo‘q. Kamida 2 ta juftlik qo‘shing.";
  wordList.innerHTML = words.map((item,i)=>`<span class="word-chip"><b>${escapeHTML(item.word)}</b><span>↔</span>${escapeHTML(item.synonym)}<button class="remove-word" data-remove="${i}" aria-label="O‘chirish">×</button></span>`).join("");
  document.querySelectorAll("[data-remove]").forEach(btn=>btn.addEventListener("click",()=>{words.splice(Number(btn.dataset.remove),1);saveWords();}));
}
function toast(message){const t=$("toast");t.textContent=message;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1900);}
function shuffle(arr){return [...arr].sort(()=>Math.random()-.5);}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
function speak(text){if(soundOn && "speechSynthesis" in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="en-US";speechSynthesis.speak(u);}}
function requireWords(){
  if(words.length<2){toast("O‘yin uchun kamida 2 ta sinonim juftligi kerak.");return false;}
  return true;
}
function openGame(type){
  if(!requireWords())return;
  gameState={type,score:0,index:0,rounds:Math.max(5,Math.min(10,words.length))};
  playArea.hidden=false;
  $("gameTitle").textContent=({match:"Juftini top",quiz:"To‘g‘ri javob",speed:"Tezkor sinov",scramble:"Harflarni tartibla",sentence:"Gapni to‘ldir"})[type];
  playArea.scrollIntoView({behavior:"smooth",block:"start"});
  if(type==="match") startMatch();
  if(type==="quiz") nextQuiz();
  if(type==="speed") startSpeed();
  if(type==="scramble") nextScramble();
  if(type==="sentence") nextSentence();
}
document.querySelectorAll(".game-card").forEach(card=>card.addEventListener("click",()=>openGame(card.dataset.game)));
$("closeGame").addEventListener("click",()=>{playArea.hidden=true;});
wordForm.addEventListener("submit",e=>{
  e.preventDefault();
  const word=$("mainWord").value.trim().toLowerCase(), synonym=$("synonymWord").value.trim().toLowerCase();
  if(!word||!synonym)return;
  if(word===synonym){toast("So‘z va sinonim bir xil bo‘lmasin.");return;}
  if(words.some(x=>x.word===word&&x.synonym===synonym)){toast("Bu juftlik allaqachon mavjud.");return;}
  words.push({word,synonym});saveWords();wordForm.reset();toast("Yangi sinonim juftligi qo‘shildi!");
});
$("resetWords").addEventListener("click",()=>{words=[...starterWords];saveWords();toast("Namunaviy so‘zlar tiklandi.");});
$("soundToggle").addEventListener("click",()=>{soundOn=!soundOn;$("soundToggle").textContent=soundOn?"🔊":"🔇";if(!soundOn&&"speechSynthesis"in window)speechSynthesis.cancel();});

function endScreen(message){
  stage.innerHTML=`<p class="stage-label">NATIJA</p><h3 class="prompt-word">${message}</h3><p class="progress">Hisobingiz: <b>${gameState.score||0}</b></p><button class="primary-btn next-btn" id="replay">Qayta o‘ynash ↻</button>`;
  $("replay").addEventListener("click",()=>openGame(gameState.type));
}
function makeOptions(correct,source){
  const pool=shuffle(source.filter(x=>x!==correct)).slice(0,3);
  return shuffle([correct,...pool]);
}
function nextQuiz(){
  if(gameState.index>=gameState.rounds){endScreen("Ajoyib natija! 🎉");return;}
  const item=pick(words), options=makeOptions(item.synonym,words.map(x=>x.synonym));
  stage.innerHTML=`<p class="stage-label">SAVOL ${gameState.index+1} / ${gameState.rounds}</p><div class="prompt-word">${escapeHTML(item.word)}</div><p class="progress">Ushbu so‘zning sinonimini tanlang</p><div class="options">${options.map(o=>`<button class="option-btn" data-answer="${escapeHTML(o)}">${escapeHTML(o)}</button>`).join("")}</div><div class="feedback" id="feedback"></div>`;
  document.querySelectorAll("[data-answer]").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("[data-answer]").forEach(x=>x.disabled=true);
    const ok=b.dataset.answer===item.synonym;
    b.classList.add(ok?"correct":"wrong");if(ok){gameState.score++;speak(item.synonym);}
    $("feedback").textContent=ok?"To‘g‘ri! Barakalla.":`To‘g‘ri javob: ${item.synonym}`;
    gameState.index++;const n=document.createElement("button");n.className="primary-btn next-btn";n.textContent="Keyingi →";n.onclick=nextQuiz;stage.append(n);
  }));
}
function startMatch(){
  const chosen=shuffle(words).slice(0,Math.min(5,words.length));
  gameState.matchItems=chosen;gameState.selected=null;gameState.matched=new Set();
  const left=shuffle(chosen.map((x,i)=>({id:i,text:x.word}))),right=shuffle(chosen.map((x,i)=>({id:i,text:x.synonym})));
  stage.innerHTML=`<p class="stage-label">MOS JUFTLIKLARNI TOPING</p><p class="progress">Avval chapdan, keyin o‘ngdan mos so‘zlarni bosing.</p><div class="match-board"><div>${left.map(x=>`<button class="match-item" data-side="l" data-id="${x.id}">${escapeHTML(x.text)}</button>`).join("")}</div><div>${right.map(x=>`<button class="match-item" data-side="r" data-id="${x.id}">${escapeHTML(x.text)}</button>`).join("")}</div></div><div class="feedback" id="feedback">Topildi: 0 / ${chosen.length}</div>`;
  document.querySelectorAll(".match-item").forEach(b=>b.addEventListener("click",()=>{
    if(b.classList.contains("done"))return;
    if(!gameState.selected){gameState.selected=b;b.classList.add("selected");return;}
    const first=gameState.selected;
    if(first===b){first.classList.remove("selected");gameState.selected=null;return;}
    if(first.dataset.side===b.dataset.side){first.classList.remove("selected");gameState.selected=b;b.classList.add("selected");return;}
    if(first.dataset.id===b.dataset.id){first.classList.remove("selected");first.classList.add("done");b.classList.add("done");gameState.matched.add(b.dataset.id);gameState.score++;$("feedback").textContent=`Topildi: ${gameState.matched.size} / ${chosen.length}`;if(gameState.matched.size===chosen.length)setTimeout(()=>endScreen("Barcha juftliklar topildi! 🎉"),500);}
    else{first.classList.remove("selected");b.classList.add("wrong");setTimeout(()=>b.classList.remove("wrong"),400);}
    gameState.selected=null;
  }));
}
function startSpeed(){
  gameState.score=0;gameState.time=60;gameState.answered=0;speedQuestion();
  gameState.timer=setInterval(()=>{gameState.time--;const el=$("timer");if(el)el.textContent=gameState.time;if(gameState.time<=0){clearInterval(gameState.timer);endScreen("Vaqt tugadi! ⏱");}},1000);
}
function speedQuestion(){
  const item=pick(words), options=makeOptions(item.synonym,words.map(x=>x.synonym));
  stage.innerHTML=`<p class="stage-label">60 SONIYALIK CHALLENGE</p><div class="timer" id="timer">${gameState.time}</div><div class="prompt-word">${escapeHTML(item.word)}</div><div class="options">${options.map(o=>`<button class="option-btn" data-speed="${escapeHTML(o)}">${escapeHTML(o)}</button>`).join("")}</div><p class="progress">To‘g‘ri javoblar: <b>${gameState.score}</b></p>`;
  document.querySelectorAll("[data-speed]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.speed===item.synonym)gameState.score++;gameState.answered++;speedQuestion();}));
}
function nextScramble(){
  if(gameState.index>=gameState.rounds){endScreen("Mashq yakunlandi! 🎉");return;}
  const item=pick(words), letters=shuffle(item.synonym.split(""));
  gameState.current=item;gameState.letters=letters;gameState.chosen=[];
  renderScramble();
}
function renderScramble(){
  const item=gameState.current;
  stage.innerHTML=`<p class="stage-label">SO‘ZNI YIG‘ING • ${gameState.index+1}/${gameState.rounds}</p><div class="prompt-word">${escapeHTML(item.word)}</div><p class="progress">Sinonimning harflarini to‘g‘ri tartibga keltiring.</p><div class="scramble-letters">${gameState.letters.map((l,i)=>`<button class="letter-btn" data-letter="${i}" ${gameState.chosen.includes(i)?"disabled":""}>${escapeHTML(l)}</button>`).join("")}</div><input class="answer-input" id="scrambleAnswer" placeholder="Javobingiz..." autocomplete="off"><div class="feedback" id="feedback"></div><button class="primary-btn next-btn" id="checkScramble">Tekshirish</button>`;
  document.querySelectorAll("[data-letter]").forEach(b=>b.addEventListener("click",()=>{gameState.chosen.push(Number(b.dataset.letter));$("scrambleAnswer").value=gameState.chosen.map(i=>gameState.letters[i]).join("");b.disabled=true;}));
  $("checkScramble").onclick=()=>{const answer=$("scrambleAnswer").value.trim().toLowerCase();if(answer===item.synonym){gameState.score++;$("feedback").textContent="To‘g‘ri!";}else{$("feedback").textContent=`To‘g‘ri javob: ${item.synonym}`;}gameState.index++;const btn=$("checkScramble");btn.textContent="Keyingi →";btn.onclick=nextScramble;};
}
const sentenceTemplates=[
  (w,s)=>`I feel <strong>${w}</strong> today because everything is going well.`,
  (w,s)=>`This is a very <strong>${w}</strong> idea for our project.`,
  (w,s)=>`The test was <strong>${w}</strong>, so I finished it quickly.`,
  (w,s)=>`She is a <strong>${w}</strong> student who learns quickly.`,
  (w,s)=>`We should <strong>${w}</strong> the meeting at nine.`
];
function nextSentence(){
  if(gameState.index>=gameState.rounds){endScreen("Gaplar juda yaxshi bajarildi! 🎉");return;}
  const item=pick(words), options=makeOptions(item.synonym,words.map(x=>x.synonym));
  const template=pick(sentenceTemplates);
  stage.innerHTML=`<p class="stage-label">GAPNI TO‘LDIRING • ${gameState.index+1}/${gameState.rounds}</p><p class="progress">Quyidagi so‘zga mos sinonimni tanlang: <b>${escapeHTML(item.word)}</b></p><div class="sentence">${template(item.word,item.synonym)}</div><div class="options">${options.map(o=>`<button class="option-btn" data-sentence="${escapeHTML(o)}">${escapeHTML(o)}</button>`).join("")}</div><div class="feedback" id="feedback"></div>`;
  document.querySelectorAll("[data-sentence]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("[data-sentence]").forEach(x=>x.disabled=true);const ok=b.dataset.sentence===item.synonym;if(ok)gameState.score++;b.classList.add(ok?"correct":"wrong");$("feedback").textContent=ok?"Ajoyib! To‘g‘ri javob.":`Bu safar emas. Sinonimi: ${item.synonym}`;gameState.index++;const n=document.createElement("button");n.className="primary-btn next-btn";n.textContent="Keyingi →";n.onclick=nextSentence;stage.append(n);}));
}
renderWords();
