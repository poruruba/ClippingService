'use strict';

const HELPER_BASE = process.env.HELPER_BASE || "/opt/";
const Response = require(HELPER_BASE + 'response');
const BinResponse = require(HELPER_BASE + 'binresponse');

const API_KEY = process.env.CLIPPING_API_KEY || "123456";
const SHARE_VALIDITY = 10 * 60 * 1000;

let share_text = null;
let share_text_uploaded = 0;
let share_file = null;
let share_file_uploaded = 0;

exports.handler = async (event, context, callback) => {
	var apikey = event.requestContext.apikeyAuth?.apikey;
	if( !apikey ){
		var params = event.queryStringParameters;
		apikey = params["x-api-key"];
	}
	if( apikey != API_KEY )
		throw new Error("invalid apikey");

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
		if( share_file.originalname )
			response.set_filename(share_file.originalname);
		return response;
	}else

	{
		throw new Error("invalid endpoint");
	}
};
