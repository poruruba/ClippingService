'use strict';

const THIS_BASE_PATH = process.env.THIS_BASE_PATH;
const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';

const KINESIS_REGION = "kinesalite";
const KINESIS_ENDPOINT = process.env.ROUTING_KINESIS_ENDPOINT;

const KINESIS_TARGET_FNAME = "kinesis.json";
const DEFAULT_HANDLER = "handler";
const DEFAULT_INTERVAL = 1000;

const AWS = require('aws-sdk');
const kinesis = new AWS.Kinesis({
	region: KINESIS_REGION,
	endpoint: KINESIS_ENDPOINT
});

const fs = require('fs');

function parse_kinesis() {
  // kinesis.jsonの検索
  const folders = fs.readdirSync(CONTROLLERS_BASE);
  folders.forEach(folder => {
    try {
      const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
      if (!stats_dir.isDirectory())
        return;
    
      const fname = CONTROLLERS_BASE + folder + "/" + KINESIS_TARGET_FNAME;
      if (!fs.existsSync(fname))
        return;
      const stats_file = fs.statSync(fname);
      if (!stats_file.isFile())
        return;

      // consumerの登録
      const defs = JSON.parse(fs.readFileSync(fname).toString());
      parse_kinesis_json(defs, CONTROLLERS_BASE + folder, folder);
    } catch (error) {
      console.error(error);
    }
  });
}

async function parse_kinesis_json(defs, folder, folder_name) {
  defs.forEach(item => {
    if (!item.enable )
      return;
      
    const handler = item.handler || DEFAULT_HANDLER;
    const proc = require(folder)[handler];
    const intervalSec = item.IntervalSec || DEFAULT_INTERVAL;
    const type = item.ShardIteratorType || "TRIM_HORIZON";

    waitForCreateAndActive(item.StreamName)
    .then( result =>{
      consumLoop(item.StreamName, item.ShardId, type, intervalSec, proc, handler, folder_name);
    });
  });
}

async function wait_async(msec){
  return new Promise(resolve => setTimeout(resolve, msec));
}

async function consumLoop(streamName, shardId, type, intervalSec, func, handler, folder_name){
  let targetShardId = shardId;
  if( !targetShardId ){
    const result = await kinesis.describeStream( { StreamName: streamName } ).promise();
    targetShardId = result.StreamDescription.Shards[0].ShardId;
  }
  
  const getIterParams = {
    ShardId: targetShardId,
    ShardIteratorType: type,
    StreamName: streamName,
  };
  const result = await kinesis.getShardIterator(getIterParams).promise();
  let shardIterator = result.ShardIterator;

  while(true){
    const getRecParams = {
      ShardIterator: shardIterator
    };
    const result2 = await kinesis.getRecords(getRecParams).promise();
    let event = {
      Records: []
    };
    for( let record of result2.Records ){
      let item = {
        kinesis: {
          kinesisSchemaVersion: "1.0",
          partitionKey: record.PartitionKey,
          sequenceNumber: record.SequenceNumber,
          data: record.Data.toString('base64'),
          approximateArrivalTimestamp: new Date(record.ApproximateArrivalTimestamp).getTime() / 1000,
        },
        eventSource: "aws:kinesis",
        eventVersion: "1.0",
        eventId: targetShardId + ":" + record.SequenceNumber,
        eventName: "aws:kinesis:record",
        awsRegion: KINESIS_REGION,
      }
      event.Records.push(item);
    }

    if( result2.Records.length > 0 ){
      try{
        const context = {
          succeed: (msg) => {
              console.log('succeed called');
          },
          fail: (error) => {
              console.log('failed called');
          },
        };
        const task = func( event, context, (error, response) =>{
          if( error )
            console.log('callback failed called');
          else
            console.log('callback succeed called');
        });
        if( task instanceof Promise || (task && typeof task.then === 'function') ){
          await task;
          console.log('promise is called');
        }
      }catch(error){
        console.log("consumLoop error catch")
      }

      console.log("kinesis(" + streamName + ":" + targetShardId + ") " + handler + ' ' + folder_name);
    }else{
      await wait_async(intervalSec);
    }

    shardIterator = result2.NextShardIterator;
  }
}

async function waitForCreateAndActive(streamName){
  return new Promise(async (resolve, reject) => {
    try{
      let result = await kinesis.describeStreamSummary( { StreamName: streamName } ).promise();
      resolve(result);
    }catch(error){
      try{
        let params = {
          StreamName: streamName,
          ShardCount: 1,
          StreamModeDetails: {
            StreamMode: "PROVISIONED"
          },
        };
        let result = await kinesis.createStream( params ).promise();
        console.log("steamName:" + steamName + " creating");

        kinesis.waitFor('streamExists', { StreamName: streamName }, async (err, data) =>{
          if (err)
            return reject(err);

          do{
            let result = await kinesis.describeStreamSummary( { StreamName: streamName } ).promise();
            if( result.StreamDescriptionSummary.StreamStatus == "ACTIVE" )
              return resolve(result);

            await wait_async(2000);
          }while(true);
        });
      }catch(error){
        return reject(error);
      }
    }
  });
}

module.exports = parse_kinesis();
