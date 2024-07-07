'use strict';

const THIS_BASE_PATH = process.env.THIS_BASE_PATH;
const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';

const WSC_TARGET_FNAME = "wsc.json";
const DEFAULT_HANDLER = "handler";
const DEFAULT_RECONNECT_INTERVAL = 10000;

const express = require('express');
const router = express.Router();
const fs = require('fs');
const ws = require('ws');

function parse_wsc() {
  // wsc.jsonの検索
  const folders = fs.readdirSync(CONTROLLERS_BASE);
  folders.forEach(folder => {
    try {
      const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
      if (!stats_dir.isDirectory())
        return;
    
      const fname = CONTROLLERS_BASE + folder + "/" + WSC_TARGET_FNAME;
      if (!fs.existsSync(fname))
        return;
      const stats_file = fs.statSync(fname);
      if (!stats_file.isFile())
        return;

      // pollerの登録
      const defs = JSON.parse(fs.readFileSync(fname).toString());
      parse_wsc_json(defs, CONTROLLERS_BASE + folder, folder);
    } catch (error) {
      console.log(error);
    }
  });
}

function parse_wsc_json(defs, folder, folder_name) {
  if (!defs.enable )
    return;

  const default_handler_name = defs.handler || DEFAULT_HANDLER;
  const default_handler = require(folder)[default_handler_name];
  const reconnect_interval = defs.reconnect || DEFAULT_RECONNECT_INTERVAL;

  const ws_connect = () =>{
    const wsc = new ws.WebSocket(defs.url);
    const context = {
      wsclib: wsc
    };
    wsc.on('error', (e) =>{
      console.error(e);
    });
    wsc.on('open', async () =>{
      let event = {
        requestContext: {
          eventType: "CONNECT",
          messageDirection: "IN",
        },
        isBase64Encoded: false,
      };
      try{
        await default_handler(event, context);
      }catch(error){
        console.error(error);
      }
    });
    wsc.on('message', async (data) =>{
      let isBase64Encoded = false;
      if( Buffer.isBuffer(data) )
        isBase64Encoded = true;
      let event = {
        requestContext: {
          eventType: "MESSAGE",
          messageDirection: "IN",
        },
        isBase64Encoded: isBase64Encoded,
        body: isBase64Encoded ? data.toString('base64') : data
      };
      try{
        await default_handler(event, context);
      }catch(error){
        console.error(error);
      }
    });
    wsc.on('close', async (e) =>{
      console.log(e);
      let event = {
        requestContext: {
          eventType: "DISCONNECT",
          messageDirection: "IN",
          reason: e
        },
        isBase64Encoded: false,
      };
      try{
        await default_handler(event, context);
      }catch(error){
        console.error(error);
      }

      setTimeout(() =>{
        ws_connect();
      }, reconnect_interval);
    });
  };
  ws_connect();

  console.log("wsc(" + defs.url + ") " + default_handler_name + ' ' + folder_name);
}

parse_wsc();

module.exports = {
  router: router,
};
