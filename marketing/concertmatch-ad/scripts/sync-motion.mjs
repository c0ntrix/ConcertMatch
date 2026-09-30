import fs from 'node:fs';
for(const p of ['index.html','portrait/index.html']){if(!fs.existsSync(p))continue;fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/<script>window.__timelines=[\s\S]*?<\/script>/,'<script>'+fs.readFileSync('motion.js','utf8')+'</script>'));}
