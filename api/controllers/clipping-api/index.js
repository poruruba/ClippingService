'use strict';

const HELPER_BASE = process.env.HELPER_BASE || "/opt/";
const Response = require(HELPER_BASE + 'response');
const BinResponse = require(HELPER_BASE + 'binresponse');
const TextResponse = require(HELPER_BASE + 'textresponse');

const API_KEY = process.env.CLIPPING_API_KEY || "123456";
const SHARE_VALIDITY = process.env.SHARE_VALIDITY || (10 * 60 * 1000);
const UPLOAD_VALIDITY = process.env.UPLOAD_VALIDITY || (10 * 60 * 1000);
const DROPBOX_CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
const DROPBOX_CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET;
const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;
const UPLOAD_MAX_SIZE = process.env.UPLOAD_MAX_SIZE || (10 * 1024 * 1024);
const UPLOAD_TITLE = "ファイルアップロード";
const UPLOAD_DESCRIPTION = "ファイルをアップロードしてください。アップロードは１回までです。";

const Dropbox = require('./lib_dropbox.js');
const dropbox = new Dropbox(DROPBOX_CLIENT_ID, DROPBOX_CLIENT_SECRET, DROPBOX_REFRESH_TOKEN);

let share_text = null;
let share_text_uploaded = 0;
let share_file = null;
let share_file_uploaded = 0;

async function process_webhook(event, context, callback){
	console.log("process_webhook called");
	if( event.httpMethod == 'GET'){
		var qs = event.queryStringParameters;
		console.log(qs);
		return new TextResponse("text/plain", qs.challenge);
	}

	var body = JSON.parse(event.body);
	console.log(body);

	var requests = await dropbox.list_request();
//	console.log(requests);
	var list = await dropbox.list();
//	console.log(list);
	var file_list = list.filter(item => item[".tag"] == 'file');
	var folder_list = list.filter(item => item[".tag"] == 'folder');

	var now = new Date().getTime();
	for( const request of requests){
		if( request.file_count > 0 ){
			var files = file_list.filter(item => item.path_display.startsWith(request.destination));
			for( const file of files ){
				if( file.size > UPLOAD_MAX_SIZE)
					await dropbox.delete(file.path_display);
			}
			var result = await dropbox.close_request(request.id);
			console.log(result);
			continue;
		}
		var created = new Date(request.created).getTime();
		if( (now - created) >= UPLOAD_VALIDITY ){
			try{
				var result = await dropbox.close_request(request.id);
				console.log(result);
			}catch(error){
				console.error(error);
			}
		}
	}

	for( const folder of folder_list){
		if( (now - Number(folder.name)) >= UPLOAD_VALIDITY){
			var files = file_list.filter(item => item.path_display.startsWith(folder.path_display));
			if( files.length <= 0){
				var result = await dropbox.delete(folder.path_display);
				console.log(result);
			}
		}
	}

	return new Response({});
}

exports.handler = async (event, context, callback) => {
	if( event.path == "/clipping-webhook" ){
		return process_webhook(event, context, callback);
	}

	var apikey = event.requestContext.apikeyAuth?.apikey;
	if( !apikey ){
		var params = event.queryStringParameters;
		apikey = params["x-api-key"];
	}
	if( apikey != API_KEY )
		throw new Error("invalid apikey");


	if( event.path == "/clipping-upload-persistent" ){
		var body = JSON.parse(event.body);
		console.log(body);

		var result = await dropbox.make_create_request("/" + new Date().getTime(), UPLOAD_TITLE, UPLOAD_DESCRIPTION);
		console.log(result);

		return new Response(result);
	}else

	if( event.path == "/clipping-list-persistent" ){
		var body = JSON.parse(event.body);
		console.log(body);

		var result = await dropbox.list();
		console.log(result);

		var file_list = result.filter(item => item[".tag"] == "file");

		var result_shared = await dropbox.list_shared_links();
		console.log(result_shared);

		for( let item of file_list ){
			var shared = result_shared.find(item2 => item2.id == item.id );
			if( shared )
				item.shared = shared;
		}

		return new Response(file_list);
	}else

	if( event.path == "/clipping-persistent-file" ){
		var body = JSON.parse(event.body);
		console.log(body);

		if( !share_file )
			return new Response({ error: "ファイルがアップロードされていません。" });
		var now = new Date().getTime();
		if( (now - share_file_uploaded) > SHARE_VALIDITY )
			return new Response({ error: "ファイルの有効期限が切れています。" });

		var fname = '/' + share_file_uploaded + '/' + share_file.originalname;
		var result = await dropbox.list();
		console.log(result);
		var file_list = result;
		var item = file_list.find( item => item.path_display == fname );
		if( item )
				throw new Error('already persistent');
		var result = await dropbox.upload(fname, share_file.buffer);
		console.log(result);

		return new Response(result);
	}else

	if( event.path == "/clipping-temporary-persistent" ){
		var body = JSON.parse(event.body);
		console.log(body);
		var file_path = body.path;

		var result = await dropbox.get_temporary_link(file_path);
		console.log(result);

		return new Response(result);
	}else

	if( event.path == "/clipping-delete-persistent" ){
		var body = JSON.parse(event.body);
		console.log(body);
		var file_path = body.path;

		var result = await dropbox.list();
		console.log(result);

		var file_list = result.filter(item => item[".tag"] == "file");
		var folder_list = result.filter(item => item[".tag"] == "folder");
		var file = file_list.find( item => item.path_display == file_path );
		if( !file )
			throw new Error('persisent not found');

		var folder = folder_list.find(item => file_path.startsWith(item.path_display));
		if( folder ){
			var files = file_list.filter(item => item.path_display.startsWith(folder.path_display));
			if( files.length > 1 ){
				result = await dropbox.delete(file_path);
				console.log(result);
			}else{
			result = await dropbox.delete(folder.path_display);
			console.log(result);
			}
		}else{
			result = await dropbox.delete(file_path);
			console.log(result);
		}

		return new Response(result);
	}else

	if( event.path == "/clipping-share-persistent" ){
		var body = JSON.parse(event.body);
		console.log(body);
		var file_path = body.path;

		var result = await dropbox.list_shared_links();
		console.log(result);
		var shared_list = result;
		var item = shared_list.find( item => item.path_display == file_path );
		if( item )
				throw new Error('already shared');
		var result = await dropbox.create_share_links(file_path);
		console.log(result);

		return new Response(result);
	}else

	if( event.path == "/clipping-share-file" ){
		var body = JSON.parse(event.body);
		console.log(body);

		if( !share_file )
			throw new Error("file not uploaded");
		var now = new Date().getTime();
		if( (now - share_file_uploaded) > SHARE_VALIDITY )
			throw new Error("validity expired");

		var fname = '/' + share_file_uploaded + '/' + share_file.originalname;
		var result = await dropbox.list();
		console.log(result);
		var file_list = result;
		var item = file_list.find( item => item.path_display == fname );
		if( !item )
				throw new Error('persisent not found');
		var result = await dropbox.create_share_links(item.path_display);
		console.log(result);

		return new Response(result);
	}else

	if( event.path == "/clipping-set-text"){
		var body = JSON.parse(event.body);
		console.log(body);
		share_text = body.text;
		share_text_uploaded = new Date().getTime();
		return new Response({ uploaded: share_text_uploaded });
	}else

	if( event.path == '/clipping-get-text' ){
		if( share_text == null )
			return new Response({ error: "テキストがアップロードされていません。" });
		var now = new Date().getTime();
		if( (now - share_text_uploaded) > SHARE_VALIDITY )
			return new Response({ error: "テキストの有効期限が切れています。" });
		return new Response({
			text: share_text,
			uploaded: share_text_uploaded
		} );
	}else

	if( event.path == "/clipping-set-file"){
		console.log(event.files);
		if( event.files?.upfile.length <= 0 )
			throw new Error("file not attached");
		share_file = event.files.upfile[0];
		if( !share_file.originalname )
			share_file.originalname = "undefined";
		share_file_uploaded = new Date().getTime();
		return new Response({ uploaded: share_file_uploaded });
	}else

	if( event.path == '/clipping-get-file' ){
		if( !share_file )
			throw new Error("file not uploaded");
		var now = new Date().getTime();
		if( (now - share_file_uploaded) > SHARE_VALIDITY )
			throw new Error("validity expired");
		var response = new BinResponse(share_file.mimetype, share_file.buffer);
		response.set_filename(share_file.originalname);
		return response;
	}else

	if( event.path == '/clipping-check-file' ){
		if( !share_file )
			return new Response({ error: "ファイルがアップロードされていません。" });
		var now = new Date().getTime();
		if( (now - share_file_uploaded) > SHARE_VALIDITY )
			return new Response({ error: "ファイルの有効期限が切れています。" });
		return new Response({
			filename: share_file.originalname,
			mimetype: share_file.mimetype,
			size: share_file.buffer.length,
			uploaded: share_file_uploaded
		})
	}else

	{
		throw new Error("invalid endpoint");
	}
};