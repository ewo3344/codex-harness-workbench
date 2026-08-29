package main

const workbenchHTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Codex Remote Workbench</title>
<style>
:root { color-scheme: dark; --bg:#0b0e12; --panel:#131820; --panel-2:#1a222d; --line:#293442; --text:#e6edf3; --muted:#8d9aaa; --accent:#57c7ff; --ok:#62d996; --warn:#f2c96d; --danger:#ff7b8b; }
* { box-sizing: border-box; }
body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font:14px/1.4 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
button,input { font:inherit; }
button { border:1px solid var(--line); background:var(--panel-2); color:var(--text); border-radius:6px; padding:8px 11px; cursor:pointer; }
button:hover { border-color:var(--accent); }
button.primary { background:#154d69; border-color:#2c87b4; }
button.danger { color:var(--danger); }
input { border:1px solid var(--line); border-radius:6px; background:#0f141b; color:var(--text); padding:8px 10px; min-width:0; }
header { height:58px; display:flex; align-items:center; gap:18px; padding:0 18px; border-bottom:1px solid var(--line); background:#10151c; }
header h1 { font-size:16px; letter-spacing:0; margin:0; white-space:nowrap; }
header .state { display:flex; align-items:center; gap:7px; color:var(--muted); }
.dot { width:8px; height:8px; border-radius:50%; background:var(--danger); display:inline-block; }
.dot.ok { background:var(--ok); }
.spacer { flex:1; }
.layout { display:grid; grid-template-columns:260px minmax(0,1fr); height:calc(100vh - 58px); }
aside { border-right:1px solid var(--line); background:#0e1319; padding:14px; overflow:auto; }
aside .actions { display:flex; gap:7px; margin-bottom:14px; }
aside .actions button { flex:1; }
#sessions { display:grid; gap:7px; }
.session-item { display:grid; gap:3px; width:100%; text-align:left; padding:10px; border-radius:6px; background:transparent; }
.session-item.active { background:#193346; border-color:#347fa7; }
.session-item .name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.session-item .meta { color:var(--muted); font-size:12px; }
main { min-width:0; display:flex; flex-direction:column; }
.toolbar { display:flex; flex-wrap:wrap; gap:8px; padding:12px 14px; border-bottom:1px solid var(--line); align-items:center; }
.toolbar .path { color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#grid { flex:1; min-height:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(360px,1fr)); grid-auto-rows:minmax(220px,1fr); gap:9px; padding:10px; overflow:auto; }
.tile { min-width:0; min-height:0; display:flex; flex-direction:column; border:1px solid var(--line); background:#0d1218; border-radius:6px; overflow:hidden; }
.tile.active { border-color:#347fa7; box-shadow:0 0 0 1px #347fa733; }
.tile-head { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid var(--line); background:var(--panel); }
.tile-head .title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tile-head .status { margin-left:auto; color:var(--muted); font-size:12px; }
.tile pre { flex:1; min-height:0; margin:0; padding:10px; overflow:auto; color:#d5e4ed; font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace; white-space:pre-wrap; word-break:break-word; }
.empty { grid-column:1/-1; display:grid; place-items:center; color:var(--muted); }
.inputbar { display:grid; grid-template-columns:minmax(0,1fr) auto auto auto; gap:8px; padding:10px 14px; border-top:1px solid var(--line); background:#10151c; }
.inputbar input { width:100%; }
#connect { position:fixed; inset:0; display:grid; place-items:center; background:#080b0fcc; z-index:5; }
#connect .box { width:min(440px,calc(100vw - 28px)); display:grid; gap:12px; padding:22px; border:1px solid var(--line); border-radius:8px; background:var(--panel); box-shadow:0 12px 44px #0008; }
#connect h2 { margin:0; font-size:18px; }
#connect p { margin:0; color:var(--muted); }
#connect .error { color:var(--danger); min-height:20px; }
@media (max-width:760px) { .layout { grid-template-columns:1fr; grid-template-rows:auto minmax(0,1fr); } aside { max-height:180px; border-right:0; border-bottom:1px solid var(--line); } #sessions { display:flex; overflow:auto; } .session-item { min-width:170px; } #grid { grid-template-columns:minmax(0,1fr); grid-auto-rows:minmax(300px,1fr); } .inputbar { grid-template-columns:minmax(0,1fr) auto; } .inputbar button:nth-of-type(n+2) { display:none; } }
</style>
</head>
<body>
<header><h1>Codex Remote Workbench</h1><span class="state"><i id="dot" class="dot"></i><span id="state">Disconnected</span></span><span class="spacer"></span><span id="host" class="state"></span></header>
<div class="layout">
<aside><div class="actions"><button id="newCodex" class="primary">New Codex</button><button id="newProcess">+ Process</button></div><div id="sessions"></div></aside>
<main><div class="toolbar"><span id="selectedName">No session</span><span class="path" id="selectedPath"></span><span class="spacer"></span><button id="refresh">Refresh</button><button id="stop" class="danger">Stop</button></div><div id="grid"></div><div class="inputbar"><input id="input" autocomplete="off" placeholder="Send terminal input; Enter sends"><button id="send" class="primary">Send</button><button id="ctrlC">Ctrl-C</button><button id="clear">Clear</button></div></main>
</div>
<div id="connect"><form class="box" id="connectForm"><h2>Connect to the local host</h2><p>The host keeps Codex CLI in a real terminal session. Paste its bearer token to open the default Codex page.</p><input id="token" type="password" autocomplete="current-password" placeholder="Bearer token"><div id="connectError" class="error"></div><button class="primary" type="submit">Connect</button></form></div>
<script>
const state={token:'',sessions:[],selected:null,outputs:{},cursors:{},socket:null};
const $=id=>document.getElementById(id);
const stripAnsi=value=>value.replace(/[\u001b\u009b]\[[0-?]*[ -/]*[@-~]/g,'');
function authHeaders(json=false){const h={Authorization:'Bearer '+state.token};if(json)h['Content-Type']='application/json';return h;}
async function api(path,options={}){options.headers={...authHeaders(Boolean(options.body)),...(options.headers||{})};const response=await fetch(path,options);let body={};try{body=await response.json();}catch(_e){}if(!response.ok)throw new Error(body.error||response.statusText);return body;}
function setConnected(value){$('dot').classList.toggle('ok',value);$('state').textContent=value?'Connected':'Disconnected';$('connect').style.display=value?'none':'grid';}
function render(){
  const list=$('sessions');list.replaceChildren();
  for(const session of state.sessions){const button=document.createElement('button');button.className='session-item'+(session.id===state.selected?' active':'');button.onclick=()=>selectSession(session.id);const name=document.createElement('span');name.className='name';name.textContent=session.name;const meta=document.createElement('span');meta.className='meta';meta.textContent=session.status+' · '+session.command;button.append(name,meta);list.append(button);}
  const grid=$('grid');grid.replaceChildren();if(!state.sessions.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No process sessions';grid.append(empty);}else for(const session of state.sessions){const tile=document.createElement('section');tile.className='tile'+(session.id===state.selected?' active':'');tile.onclick=()=>selectSession(session.id);const head=document.createElement('div');head.className='tile-head';const title=document.createElement('span');title.className='title';title.textContent=session.name;const status=document.createElement('span');status.className='status';status.textContent=session.status;head.append(title,status);const pre=document.createElement('pre');pre.textContent=stripAnsi(state.outputs[session.id]||'');tile.append(head,pre);grid.append(tile);}
  const selected=state.sessions.find(item=>item.id===state.selected);$('selectedName').textContent=selected?selected.name:'No session';$('selectedPath').textContent=selected?selected.cwd:'';$('host').textContent=selected?'PID '+selected.pid:'';
}
function closeSocket(){if(state.socket){state.socket.close();state.socket=null;}}
function connectSocket(id){closeSocket();const scheme=location.protocol==='https:'?'wss':'ws';const socket=new WebSocket(scheme+'://'+location.host+'/ws/v1/sessions/'+encodeURIComponent(id)+'?token='+encodeURIComponent(state.token));state.socket=socket;socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.type==='snapshot'){state.outputs[id]=message.output||'';state.cursors[id]=message.cursor||0;render();scrollActive();}else if(message.type==='output'){state.outputs[id]=(state.outputs[id]||'')+message.data;state.cursors[id]=message.seq||state.cursors[id];render();scrollActive();}else if(message.type==='status'){const item=state.sessions.find(item=>item.id===id);if(item)item.status=message.status;render();}};socket.onclose=()=>{if(state.selected===id)$('state').textContent='Connected · polling';};}
function scrollActive(){const panes=document.querySelectorAll('.tile pre');if(panes.length)panes.forEach(p=>{p.scrollTop=p.scrollHeight;});}
async function selectSession(id){state.selected=id;render();connectSocket(id);await pollSession(id);render();}
async function pollSession(id){try{const body=await api('/api/v1/sessions/'+encodeURIComponent(id)+'/output?cursor='+(state.cursors[id]||0));if(body.reset)state.outputs[id]='';for(const chunk of body.chunks||[])state.outputs[id]=(state.outputs[id]||'')+(chunk.data??chunk.Data??'');state.cursors[id]=body.cursor||state.cursors[id]||0;const item=state.sessions.find(item=>item.id===id);if(item&&body.session)item.status=body.session.status;}catch(error){$('state').textContent=error.message;}}
async function refresh(){try{const body=await api('/api/v1/sessions');state.sessions=body.sessions||[];if(!state.selected&&state.sessions.length)state.selected=state.sessions[0].id;if(state.selected&&!state.sessions.some(item=>item.id===state.selected))state.selected=state.sessions[0]?.id||null;render();if(state.selected&&!state.socket)connectSocket(state.selected);}catch(error){setConnected(false);$('connectError').textContent=error.message;}}
async function create(command,args,name){const body=await api('/api/v1/sessions',{method:'POST',body:JSON.stringify({name:name||'',command:command||'',args:args||[]})});const id=body.session.id;await refresh();await selectSession(id);}
async function send(data){if(!state.selected||!data)return;try{if(state.socket&&state.socket.readyState===WebSocket.OPEN)state.socket.send(JSON.stringify({type:'input',data}));else await api('/api/v1/sessions/'+encodeURIComponent(state.selected)+'/input',{method:'POST',body:JSON.stringify({data})});}catch(error){$('state').textContent=error.message;}}
async function connect(){state.token=$('token').value.trim();if(!state.token){$('connectError').textContent='Token is required';return;}try{const info=await api('/api/v1/info');$('host').textContent=info.defaultCwd||'';localStorage.setItem('crw-token',state.token);setConnected(true);await refresh();if(!state.sessions.length)await create('',[], 'codex');else if(state.selected)await selectSession(state.selected);}catch(error){setConnected(false);$('connectError').textContent=error.message;}}
$('connectForm').onsubmit=event=>{event.preventDefault();connect();};$('refresh').onclick=refresh;$('newCodex').onclick=()=>create('',[], 'codex-'+(state.sessions.length+1));$('newProcess').onclick=()=>{const command=prompt('Executable (for example bash or npm)');if(command)create(command,[],command);};$('stop').onclick=async()=>{if(state.selected&&confirm('Stop this process?')){await api('/api/v1/sessions/'+encodeURIComponent(state.selected)+'/stop',{method:'POST'});await refresh();}};$('send').onclick=()=>{const value=$('input').value+'\n';$('input').value='';send(value);};$('input').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();$('send').click();}};$('ctrlC').onclick=()=>send('\u0003');$('clear').onclick=()=>{if(state.selected){state.outputs[state.selected]='';render();}};
const queryToken=new URLSearchParams(location.search).get('token');$('token').value=queryToken||localStorage.getItem('crw-token')||'';if(queryToken)history.replaceState({},'',location.pathname);if($('token').value)connect();setInterval(async()=>{if(state.token){await refresh();for(const item of state.sessions)if(item.id!==state.selected)await pollSession(item.id);render();}},1500);
</script>
</body>
</html>`
