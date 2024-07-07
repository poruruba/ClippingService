'use strict';

const THIS_BASE_PATH = __dirname + "/..";

const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';
const ZIP_FNAME = 'lambda_upload.zip';

const AWS = require('aws-sdk');
AWS.config.update({
	region: "ap-northeast-1",
});
const lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
const TEMP_FOLDER = THIS_BASE_PATH + '/temp/';

const fs = require('fs');
const archiver = require('archiver');

async function folderToZip(target_folder) {
	try{
		fs.mkdirSync(TEMP_FOLDER);
	}catch(error){}

	return new Promise((resolve, reject) => {
		const output = fs.createWriteStream(TEMP_FOLDER + ZIP_FNAME);
		const archive = archiver('zip', {
			zlib: { level: 9 }
		});

		output.on('close', function () {
			console.log(TEMP_FOLDER + ZIP_FNAME + ': ' + archive.pointer() + ' total bytes');
			resolve();
		});

		output.on('end', function () {
			console.log('Data has been drained');
		});

		archive.on('error', function (err) {
			reject(err);
		});

		archive.pipe(output);
		archive.directory(CONTROLLERS_BASE + target_folder, false);
		archive.finalize();
	});
}

if (process.argv.length < 3) {
	console.log('usage: npm run lambda_upload [folder_name]');
	return;
}

var folder_name = process.argv[2];

(async () => {
	try {
		await folderToZip(folder_name);

		var binary = fs.readFileSync(TEMP_FOLDER + ZIP_FNAME);

		var params = {
			FunctionName: folder_name,
			ZipFile: binary
		};
		lambda.updateFunctionCode(params, (err, data) => {
			if (err) {
				console.log(err, err.stack);
				return;
			}
			console.log("Lambda Uploaded");
			console.log("FunctionName: " + data.FunctionName);
			console.log("FunctionArn: " + data.FunctionArn);
			console.log("Runtime: " + data.Runtime);
		});
	} catch (error) {
		console.error(error);
	}
})();

