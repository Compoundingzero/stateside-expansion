import {mkdir,lstat,chown,chmod,access,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,join} from 'node:path';

/** Prepare only the board volume; drop privileges before opening SQLite or HTTP. */
export async function prepareBoardStorage({directory,railway=Boolean(process.env.RAILWAY_ENVIRONMENT_ID)}) {
  const path=resolve(directory);
  process.umask(0o077);
  if(railway){
    const mounts=await readFile('/proc/self/mountinfo','utf8');
    const mounted=mounts.split('\n').some(line=>line.split(' ')[4]==='/data');
    if(path!=='/data'||process.env.RAILWAY_VOLUME_MOUNT_PATH!=='/data'||!mounted)throw Error('Persistent board storage is not mounted at the configured path.');
  }else await mkdir(path,{recursive:true,mode:0o700});
  const dir=await lstat(path);
  if(!dir.isDirectory()||dir.isSymbolicLink())throw Error('Board storage must be a real directory.');
  const privileged=typeof process.getuid==='function'&&process.getuid()===0;
  if(privileged&&railway){
    await chown(path,1000,1000);await chmod(path,0o700);
    for(const name of ['eln.sqlite','eln.sqlite-wal','eln.sqlite-shm','eln.sqlite-journal']){
      const file=join(path,name);let info;try{info=await lstat(file)}catch(error){if(error.code==='ENOENT')continue;throw error}
      if(!info.isFile()||info.isSymbolicLink())throw Error('Board storage contains an unexpected file type.');
      await chown(file,1000,1000);await chmod(file,0o600);
    }
    process.setgroups([]);process.setgid(1000);process.setuid(1000);
    if(process.getuid()!==1000||process.getgid()!==1000)throw Error('Board runtime privilege drop failed.');
  }else await chmod(path,0o700);
  await access(path,constants.R_OK|constants.W_OK|constants.X_OK);
  return path;
}
