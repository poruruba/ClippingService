'use strict';

const THIS_BASE_PATH = __dirname + "/..";

const AWS = require('aws-sdk');
AWS.config.update({
	region: "ap-northeast-1",
});
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
const TEMP_SUB_FOLDER = 'temp/';
const TEMP_FOLDER = THIS_BASE_PATH + '/' + TEMP_SUB_FOLDER;

const fs = require('fs');
const https = require('https');

if (process.argv.length < 3) {
	console.log('usage: npm run lambda_download [func_name]');
	return;
}

var func_name = process.argv[2];

var params = {
  FunctionName: func_name
};
lambda.getFunction(params, async (err, data) => {
  if (err) {
    console.log(err, err.stack);
    return;
  }
  console.log("FunctionName: " + data.Configuration.FunctionName);
  console.log("FunctionArn: " + data.Configuration.FunctionArn);
  console.log("Runtime: " + data.Configuration.Runtime);

  var result = await do_get(data.Code.Location);
  fs.writeFileSync(TEMP_FOLDER + func_name + ".zip", result);
  console.log("Lambda Downloaded: " + TEMP_SUB_FOLDER + func_name + ".zip");
});

function do_get(url) {
  return new Promise((resolve, reject) =>{
    https.get(url, (res) => {
      let data = [];
    
      res.on('data', (chunk) => {
        data.push(chunk);
      });
    
      res.on('end', () => {
        var buf = Buffer.concat( data );
        resolve(buf);
      });
    }).on('error', (e) => {
      reject(e);
    });
  });
}
