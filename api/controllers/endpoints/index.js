'use strict';

const THIS_BASE_PATH = process.env.THIS_BASE_PATH;

const HELPER_BASE = process.env.HELPER_BASE || "/opt/";
const Response = require(HELPER_BASE + 'response');
const TextResponse = require(HELPER_BASE + 'textresponse');

const DEFAULT_HANDLER = "handler";

const swagger_utils = require(HELPER_BASE + 'swagger_utils');
const fs = require('fs');

const SWAGGER_DEFAULT_BASE = THIS_BASE_PATH + '/api/swagger/';
const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';
const BACKEND_BASE = THIS_BASE_PATH + '/amplify/backend/function/';
const CRON_TARGET_FNAME = "cron.json";
const SQS_TARGET_FNAME = "sqs.json";
const UDP_TARGET_FNAME = "udp.json";
const MQTT_TARGET_FNAME = "mqtt.json";
const WS_TARGET_FNAME = "ws.json";
const WSC_TARGET_FNAME = "wsc.json";
const SWAGGER_TARGET_FNAME = "swagger.yaml";
const PUBLIC_FOLDER = process.env.THIS_BASE_PATH + "/public/";

function append_swagger(root, folder, baseFolder, extraFolder){
    try {
      const stats_dir = fs.statSync(baseFolder + folder);
      if (!stats_dir.isDirectory())
        return;
      const stats_file = fs.statSync(baseFolder + folder + (extraFolder ? ('/' + extraFolder + '/') : '/') + SWAGGER_TARGET_FNAME);
      if (!stats_file.isFile())
        return;
    } catch (error) {
      return;
    }

    const file = fs.readFileSync(baseFolder + folder + (extraFolder ? ('/' + extraFolder + '/') : '/') + SWAGGER_TARGET_FNAME, 'utf-8');
    const doc = swagger_utils.parse_document(file);

    swagger_utils.append_paths(root, doc, folder);
    swagger_utils.append_definitions(root, doc, folder);
}

exports.handler = async (event, context, callback) => {
  if( event.path == '/swagger'){
    const folder = event.queryStringParameters.folder;
    const root_file = fs.readFileSync(SWAGGER_DEFAULT_BASE + SWAGGER_TARGET_FNAME, 'utf-8');
    const root = swagger_utils.parse_document(root_file);

    root.contents.set("host", event.headers.host);
//    root.contents.set("basePath", event.stage);

    swagger_utils.delete_paths(root);
    swagger_utils.delete_definitions(root);

    if( folder ){
        append_swagger(root, folder, CONTROLLERS_BASE);
    }else{
      const folders = fs.readdirSync(CONTROLLERS_BASE);
      folders.forEach(folder => {
        append_swagger(root, folder, CONTROLLERS_BASE);
      });

      if( fs.existsSync(BACKEND_BASE) ){
        const stats_folder2 = fs.statSync(BACKEND_BASE);
        if( !stats_folder2.isDirectory() ){
          const folders2 = fs.readdirSync(BACKEND_BASE);
          folders2.forEach(folder => {
            append_swagger(root, folder, BACKEND_BASE, 'src');
          });
        }
      }
    }

    return new TextResponse("application/x-yaml", root);
  }else
  if( event.path == '/endpoints' ){
    let endpoints = {
      cron: [],
      mqtt: [],
      sqs: [],
      udp: [],
      ws: [],
      wsc: [],
    };

    const folders = fs.readdirSync(CONTROLLERS_BASE);
    folders.forEach(folder => {
      try {
        const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
        if (!stats_dir.isDirectory())
          return;

        let fname;
        let root;
        
        root = endpoints.cron;
        fname = CONTROLLERS_BASE + folder + "/" + CRON_TARGET_FNAME;
        if (fs.existsSync(fname)){
          const stats_file = fs.statSync(fname);
          if (stats_file.isFile()){
            const defs = JSON.parse(fs.readFileSync(fname).toString());
            for(let def of defs){
              const item = {
                operationId: folder,
                schedule: def.schedule,
                handler: def.handler ? def.handler : DEFAULT_HANDLER,
                enable: def.enable ? true : false
              };
              root.push(item);
            }
          }
        }

        root = endpoints.sqs;
        fname = CONTROLLERS_BASE + folder + "/" + SQS_TARGET_FNAME;
        if (fs.existsSync(fname)){
          const stats_file = fs.statSync(fname);
          if (stats_file.isFile()){
            const defs = JSON.parse(fs.readFileSync(fname).toString());
            for(let def of defs){
              const item = {
                operationId: folder,
                QueueUrl: def.QueueUrl,
                handler: def.handler ? def.handler : DEFAULT_HANDLER,
                enable: def.enable ? true : false
              };
              root.push(item);
            }
          }
        }

        root = endpoints.udp;
        fname = CONTROLLERS_BASE + folder + "/" + UDP_TARGET_FNAME;
        if (fs.existsSync(fname)){
          const stats_file = fs.statSync(fname);
          if (stats_file.isFile()){
            const defs = JSON.parse(fs.readFileSync(fname).toString());
            for(let def of defs){
              const item = {
                operationId: folder,
                port: def.port,
                handler: def.handler ? def.handler : DEFAULT_HANDLER,
                enable: def.enable ? true : false
              };
              root.push(item);
            }
          }
        }

        root = endpoints.mqtt;
        fname = CONTROLLERS_BASE + folder + "/" + MQTT_TARGET_FNAME;
        if (fs.existsSync(fname)){
          const stats_file = fs.statSync(fname);
          if (stats_file.isFile()){
            const defs = JSON.parse(fs.readFileSync(fname).toString());
            for(let def of defs){
              const item = {
                operationId: folder,
                topic: def.topic,
                handler: def.handler ? def.handler : DEFAULT_HANDLER,
                enable: def.enable ? true : false
              };
              root.push(item);
            }
          }
        }

        root = endpoints.ws;
        fname = CONTROLLERS_BASE + folder + "/" + WS_TARGET_FNAME;
        if (fs.existsSync(fname)){
          const stats_file = fs.statSync(fname);
          if (stats_file.isFile()){
            const def = JSON.parse(fs.readFileSync(fname).toString());
            const item = {
              operationId: folder,
              stage: def.stage,
              handler: def.handler ? def.handler : DEFAULT_HANDLER,
              enable: def.enable ? true : false
            };
            root.push(item);
          }
        }

        root = endpoints.wsc;
        fname = CONTROLLERS_BASE + folder + "/" + WSC_TARGET_FNAME;
        if (fs.existsSync(fname)){
          const stats_file = fs.statSync(fname);
          if (stats_file.isFile()){
            const def = JSON.parse(fs.readFileSync(fname).toString());
            const item = {
              operationId: folder,
              url: def.url,
              handler: def.handler ? def.handler : DEFAULT_HANDLER,
              enable: def.enable ? true : false
            };
            root.push(item);
          }
        }

      } catch (error) {
        console.log(error);
      }
    });

    return new Response(endpoints);
  }else
  if( event.path == '/sites'){
    let list = [];
    const folders = fs.readdirSync(PUBLIC_FOLDER);
    folders.forEach(folder => {
      try{
        const stats_dir = fs.statSync(PUBLIC_FOLDER + folder);
        if (!stats_dir.isDirectory())
          return;
        const stats_file = fs.statSync(PUBLIC_FOLDER + folder + '/' + "index.html");
        if (!stats_file.isFile())
          return;

        const html = fs.readFileSync(PUBLIC_FOLDER + folder + '/' + "index.html").toString();
        const head_start = html.toLowerCase().indexOf('<head>');
        const head_end = html.toLowerCase().indexOf('</head>');
        const title_start = html.toLowerCase().indexOf('<title>');
        const title_end = html.toLowerCase().indexOf('</title>');
        if( head_start < 0 || head_end < 0 || head_start > head_end || title_start > title_end || head_start > title_start || head_end < title_end ){
          list.push({
            folder: folder
          });
        }else{
          const title = html.substring(title_start + 7, title_end);
          list.push({
            folder: folder,
            title: title
          });
        }
      }catch(error){
//        console.log(error);
      }
    });

    return new Response({ list: list } );
  }else{
    throw new Error('unknown endpoints');
  }
}
