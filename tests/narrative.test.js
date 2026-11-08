const assert=require('node:assert/strict');
const {createGame}=require('./runtime');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
for(const experience of ['combat','story'])for(const wave of [1,10,54,55,60]){
  const game=createGame(9),run=code=>game.run(code);
  run(`newGame();G.experience='${experience}';G.wave=${wave};StoryFlow.setPlayback(false);
    DreamFragments.FRAGMENT_DEFS.forEach(f=>DreamFragments.collectFragment(f.id));
    WAVE_STORY.filter(s=>s.wave<=${wave}).forEach(s=>StoryFlow.skip(s));
    globalThis.sealed=DreamFragments.FRAGMENT_DEFS.filter(f=>f.revealWave);
    globalThis.output=JSON.stringify([DreamFragments.getCollectedFragments(),DreamFragments.getUnlockStatus(),DreamDiary.getEntries()]);`);
  for(const fragment of run('sealed.map(f=>({id:f.id,name:f.name,story:f.story}))')){
    ok(!run(`output.includes(${JSON.stringify(fragment.name)})`),'title hidden on '+experience+' wave '+wave+' '+fragment.id);
    ok(!run(`output.includes(${JSON.stringify(fragment.story)})`),'body hidden on every public route '+fragment.id);
  }
  run("showFragmentGallery();showDiaryPanel();showNPCPanel();renderQuestPanel(true);openFragmentDetail('frag_3');");
  ok(!run("document.getElementById('fragmentList').innerHTML.includes('床边的合照')"),'gallery DOM does not reveal a sealed title');
  ok(run("document.getElementById('fragmentDetail').innerHTML===''"),'locked fragment detail remains closed');
  assert.deepEqual(game.errors,[]);
}
const game=createGame(19),run=code=>game.run(code);
run(`newGame();G.experience='story';StoryFlow.setPlayback(true);DreamFragments.collectFragment('frag_3');G.wave=55;
  DreamDiary._entries.push({id:'legacy-fragment',type:'fragment',wave:9,content:'收集到「床边的合照」：'+DreamFragments.FRAGMENT_DEFS.find(f=>f.id==='frag_3').story});
  globalThis.truth=WAVE_STORY.find(s=>s.wave===55);StoryFlow.begin(truth);`);
ok(!run('StoryKnowledge.canReveal(55)'),'beginning the scene does not claim it was read');
ok(!run("JSON.stringify(DreamDiary.getEntries()).includes('第四个人被被子盖住')"),'legacy diary entries are masked before revelation');
run("StoryFlow.settle(truth,truth.choices[0],'manual');");
ok(run('StoryKnowledge.canReveal(55)'),'manual acknowledgement records the milestone');
ok(run("JSON.stringify(DreamDiary.getEntries()).includes('第四个人被被子盖住')"),'collected diary entries reveal their authored text afterwards');
run("newGame();G.experience='combat';G.wave=1;");
ok(run('StoryKnowledge.canReveal(55)'),'known story stays readable in later runs and combat mode');
ok(run("DreamFragments.getCollectedFragments().some(f=>f.name==='床边的合照')"),'collection and reading progress both persist across runs');
run("META.storySeen=[];META.endingIds=['unknown'];G.storyState={events:{'wave:55':{status:'settled',method:'default'}}};G.wave=60;");
ok(!run('StoryKnowledge.canReveal(55)'),'default rewards and unknown endings cannot forge a reveal');
run("META.endingIds=[STORY_ENDINGS[0].id];");ok(run('StoryKnowledge.canReveal(55)'),'existing legitimate ending records preserve story knowledge');
run("META.endingIds=[];G.experience='story';StoryFlow.restore(null,55);");ok(run('StoryKnowledge.canReveal(55)'),'legacy story saves preserve prior narrative progress');
run("G.experience='combat';");ok(!run('StoryKnowledge.canReveal(55)'),'a combat identity cannot reveal through legacy wave inference');
run("newGame();G.wave=1;globalThis.earlyQuest=JSON.stringify(QuestSystem.getSnapshot());");
ok(!run("earlyQuest.includes(QUEST_CHAPTERS[5].title)"),'future quest titles stay out of public snapshots');
run("openQuestItem('last_clock');");ok(run("document.getElementById('itemLore').textContent===''"),'unowned quest items cannot open their lore');
run("QuestSystem._s.items.last_clock=1;openQuestItem('last_clock');");ok(run("document.getElementById('itemLore').textContent===QUEST_ITEMS.last_clock.lore"),'owned quest items retain their accessible clue text');
run("DreamDiary._entries=[{type:'story',wave:60,content:'late narrative',typeDef:{name:'<img src=x onerror=alert(1)>',color:'bad'}}];showDiaryPanel();");
ok(!run("document.getElementById('diaryList').innerHTML.includes('<img')"),'imported diary badges use canonical metadata');
ok(!run("DreamDiary.getEntries()[0].content==='late narrative'"),'unseen late diary content stays sealed');
assert.deepEqual(game.errors,[]);console.log('Narrative entry and spoiler boundaries: '+checks+' checks passed');
