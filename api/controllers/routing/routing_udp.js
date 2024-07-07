'use strict';

const THIS_BASE_PATH = process.env.THIS_BASE_PATH;
const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';

const UDP_TARGET_FNAME = "udp.json";
const DEFAULT_HANDLER = "handler";

const fs = require('fs');
const dgram = require('dgram');

function parse_udp() {
  // cron.jsonの検索
  const folders = fs.readdirSync(CONTROLLERS_BASE);
  folders.forEach(folder => {
    try {
      const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
      if (!stats_dir.isDirectory())
        return;
    
      const fname = CONTROLLERS_BASE + folder + "/" + UDP_TARGET_FNAME;
      if (!fs.existsSync(fname))
        return;
      const stats_file = fs.statSync(fname);
      if (!stats_file.isFile())
        return;

      // cronの登録
      const defs = JSON.parse(fs.readFileSync(fname).toString());
      parse_udp_json(defs, CONTROLLERS_BASE + folder, folder);
    } catch (error) {
      console.log(error);
    }
  });
}

function parse_udp_json(defs, folder, folder_name) {
  defs.forEach(item => {
    if (!item.enable )
      return;
      
    const handler = item.handler || DEFAULT_HANDLER;
    const port = item.port;
    const proc = require(folder)[handler];

    const socket = dgram.createSocket('udp4');
    socket.on('listening', () =>{
//      console.log('UDP(' + port + ') listening');
    });
    socket.on('error', (error) =>{
      console.log('udp(' + port + ') error: ' + error);
    });
    socket.on('message', (message, remote) =>{
      try{
        var task = proc({ body: Buffer.from(message).toString(), remote: remote }, { udp: socket });
        if( task instanceof Promise || (task && typeof task.then === 'function') ){
          task.catch(err =>{
            console.log(err);
          });
        }
      }catch(error){
          console.log(error);
      }
    });
    socket.bind(port);

    console.log("udp(" + port + ") " + handler + ' ' + folder_name);
  });
}

module.exports = parse_udp();
