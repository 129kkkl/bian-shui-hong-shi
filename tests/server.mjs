import { spawn } from 'node:child_process';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const proc=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'44173'},windowsHide:true});
try{
  await new Promise((resolve,reject)=>{proc.stdout.once('data',resolve);proc.once('error',reject);proc.once('exit',code=>reject(new Error(`Server exited: ${code}`)));});
  const response=await fetch('http://127.0.0.1:44173/');
  const served=Buffer.from(await response.arrayBuffer()),file=await readFile('汴水虹市.html');
  assert.equal(response.status,200);assert.equal(Buffer.compare(served,file),0);
  const result={pass:true,status:response.status,bytes:file.length,sha256:createHash('sha256').update(file).digest('hex'),message:'本地启动命令返回的 HTML 与最终交付文件逐字节一致'};
  await writeFile('artifacts/server-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{proc.kill();}
