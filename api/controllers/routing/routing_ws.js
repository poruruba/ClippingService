'use strict';

const THIS_BASE_PATH = process.env.THIS_BASE_PATH;
const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';

const WS_TARGET_FNAME = "ws.json";
const DEFAULT_HANDLER = "handler";

const express = require('express');
const router = express.Router();
const fs = require('fs');
const uuid = require('uuid');

let ws_list = {};
let g_wss;

class WebSocketLib{
  constructor(params){
    this.stage = params.stage;
  }

  getConnectionList(callback){
    try{
      let list = [];
      for( let [key] of ws_list[this.stage] )
        list.push(key);

      if( callback ){
        callback(null, list);
      }else{
        return {
          promise: () => Promise.resolve(list)
        }
      }
    }catch(error){
      if( callback ){
        callback(error);
      }else{
        return {
          promise: () => Promise.reject(error)
        }
      }
    }
  }

  deleteConnection(command, callback){
    try{
      const connectionId = command.ConnectionId;
      const ws = ws_list[this.stage].get(connectionId);
      if( !ws )
        throw new Error("ws not found");
      ws.close();

      if( callback ){
        callback(null, {});
      }else{
        return {
          promise: () => Promise.resolve({})
        }
      }
    }catch(error){
      if( callback ){
        callback(error);
      }else{
        return {
          promise: () => Promise.reject(error)
        }
      }
    }
  }

  postToConnection(command, callback){
    try{
      const connectionId = command.ConnectionId;
      const Data = command.Data;
      const ws = ws_list[this.stage].get(connectionId);
      if( !ws )
        throw new Error("ws not found");
      ws.send(Data);

      if( callback ){
        callback(null, {});
      }else{
        return {
          promise: () => Promise.resolve({})
        }
      }
    }catch(error){
      if( callback ){
        callback(error);
      }else{
        return {
          promise: () => Promise.reject(error)
        }
      }
    }
  }
}

function parse_ws() {
  // ws.jsonの検索
  const folders = fs.readdirSync(CONTROLLERS_BASE);
  folders.forEach(folder => {
    try {
      const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
      if (!stats_dir.isDirectory())
        return;
    
      const fname = CONTROLLERS_BASE + folder + "/" + WS_TARGET_FNAME;
      if (!fs.existsSync(fname))
        return;
      const stats_file = fs.statSync(fname);
      if (!stats_file.isFile())
        return;

      // pollerの登録
      const defs = JSON.parse(fs.readFileSync(fname).toString());
      parse_ws_json(defs, CONTROLLERS_BASE + folder, folder);
    } catch (error) {
      console.log(error);
    }
  });
}

function parse_ws_json(defs, folder, folder_name) {
  if (!defs.enable )
    return;

  const default_handler_name = defs.handler || DEFAULT_HANDLER;
  const default_handler = require(folder)[default_handler_name];
  const connect_handler = defs.connect_handler ? require(folder)[defs.connect_handler] : null;
  const disconnect_handler = defs.disconnect_handler ? require(folder)[defs.disconnect_handler] : null;
  const stage = defs.stage;
  const context = {
    wslib: new WebSocketLib({ stage: stage })
  };

  ws_list[stage] = new Map();
  
  router.ws('/' + stage, async (ws, req) =>{
    const connectionId = uuid.v4();
    ws_list[stage].set(connectionId, ws);

    if( connect_handler ){
      let event = {
        headers: req.headers,
        requestContext: {
          routeKey: "$connect",
          eventType: "CONNECT",
          messageDirection: "IN",
          stage: stage,
          identity: {
            userAgent: req.headers['user-agent'],
          },
          connectionId: connectionId
        },
        isBase64Encoded: false,
        session: req.session,
        queryStringParameters: req.query,
      };
      try{
        await connect_handler(event, context);
      }catch(error){
        console.error(error);
      }        
    }

    ws.on('close', async (e) =>{
      ws_list[stage].delete(connectionId);

      if( disconnect_handler ){
        let event = {
          headers: req.headers,
          requestContext: {
            routeKey: "$disconnect",
            eventType: "DISCONNECT",
            messageDirection: "IN",
            stage: stage,
            identity: {
              userAgent: req.headers['user-agent'],
            },
            connectionId: connectionId
          },
          isBase64Encoded: false,
          session: req.session,
        };
        try{
          await disconnect_handler(event, context);
        }catch(error){
          console.error(error);
        }          
      }
    });

    ws.on('message', async (msg) =>{
      let event = {
        headers: req.headers,
        requestContext: {
          eventType: "MESSAGE",
          messageDirection: "IN",
          stage: stage,
          identity: {
            userAgent: req.headers['user-agent'],
          },
          connectionId: connectionId
        },
        isBase64Encoded: false,
        body: msg,
        session: req.session,
      };
      try{
        const payload = JSON.parse(msg);
        if( !payload.action )
          throw "now action";
        if( !defs.routekeys )
          throw "no routekey";
        const item = defs.routekeys.find( routekey => routekey.action == payload.action );
        if( !item )
          throw "no routekey";
        
        try{
          event.requestContext.routeKey = item.action;
          await require(folder)[item.handler || DEFAULT_HANDLER](event, context);
        }catch(err){
          console.error(err);
        }
      }catch(err){
        event.requestContext.routeKey = "$default";
        try{
          await default_handler(event, context);
        }catch(error){
          console.error(error);
        }
      }
    });
  });

  console.log("ws(/" + stage + ") " + default_handler_name + ' ' + folder_name);
}

function set_wss(wss){
  g_wss = wss;
}

function get_wss(){
  return g_wss;
}

parse_ws();

module.exports = {
  router: router,
  setWss: set_wss,
  getWss: get_wss,
};
