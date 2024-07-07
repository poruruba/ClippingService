'use strict';

const THIS_BASE_PATH = process.env.THIS_BASE_PATH;
const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';
const BACKEND_BASE = THIS_BASE_PATH + '/amplify/backend/function/';

const CRON_TARGET_FNAME = "cron.json";
const DEFAULT_HANDLER = "handler";

const fs = require('fs');
const cron = require('node-cron');

function parse_cron() {
  // cron.jsonの検索
  const folders = fs.readdirSync(CONTROLLERS_BASE);
  folders.forEach(folder => {
    try {
      const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
      if (!stats_dir.isDirectory())
        return;
    
      const fname = CONTROLLERS_BASE + folder + "/" + CRON_TARGET_FNAME;
      if (!fs.existsSync(fname))
        return;
      const stats_file = fs.statSync(fname);
      if (!stats_file.isFile())
        return;

      // cronの登録
      const defs = JSON.parse(fs.readFileSync(fname).toString());
      parse_cron_json(defs, CONTROLLERS_BASE + folder, folder);
    } catch (error) {
      console.log(error);
    }
  });
}

function parse_cron_json(defs, folder, folder_name) {
  defs.forEach(item => {
    const handler = item.handler || DEFAULT_HANDLER;
    const proc = require(folder)[handler];

    if( item.onetime ){
      try{
        proc(item.param);
      }catch(error){
        console.error(error);
      }
    }
    if( !item.enable )
      return;

    cron.schedule(item.schedule, () => {
      try{
        proc(item.param);
      }catch(error){
        console.error(error);
      }
    });
    console.log(item.schedule + " cron " + handler + ' ' + folder_name);
  });
}

module.exports = parse_cron();
