const dropbox_base_url = "https://api.dropboxapi.com";
const dropbox_content_url = "https://content.dropboxapi.com";

const FormData = require('form-data');
const { URL, URLSearchParams } = require('url');
const fetch = require('node-fetch');
const Headers = fetch.Headers;

class Dropbox {
  constructor(client_id, client_secret, refresh_token){
    this.client_id = client_id;
    this.client_secret = client_secret;
    this.refresh_token = refresh_token;
    this.token_created = 0;
  }

  async retrieve_access_token(){
    var now = new Date().getTime();
    if( (now - this.token_created) >= (50 * 60 * 1000) ){
      var input = {
        url: dropbox_base_url + "/oauth2/token",
        params : {
          grant_type: "refresh_token",
          refresh_token: this.refresh_token,
          client_id: this.client_id,
          client_secret: this.client_secret,
        },
        content_type: "application/x-www-form-urlencoded"
      };
      var result = await do_http(input);
//      console.log(result);
      this.token = result.access_token;
      this.token_created = now;
    }
    return this.token;
  }

  async upload(path, buffer) {
    await this.retrieve_access_token();
    var params = {
      path: path,
      mode: "overwrite",
    };
    var input = {
      url: dropbox_content_url + "/2/files/upload",
      body: buffer,
      content_type: "application/octet-stream",
      headers: {
        "Dropbox-API-Arg": JSON.stringify(params)
      },
      token: this.token,
    };
    var result = await do_http(input);
    return result;
  }

  async delete(path) {
    await this.retrieve_access_token();
    var input = {
      url: dropbox_base_url + "/2/files/delete_v2",
      token: this.token,
      body: {
        path: path
      }
    };
    var result = await do_http(input);
    return result;
  }

  async list() {
    await this.retrieve_access_token();
    var input = {
      url: dropbox_base_url + "/2/files/list_folder",
      token: this.token,
      body: {
        path: "",
        recursive: true,
      }
    };
    var result = await do_http(input);
    //    console.log(result);
    var entries = result.entries;
    while (result.has_more) {
      var input = {
        url: dropbox_base_url + "/2/files/list_folder/continue",
        token: this.token,
        body: {
          cursor: result.cursor
        }
      };
      var result = await do_http(input);
      //      console.log(result);
      entries = entries.concat(result.entries);
    }

    return entries;
  }

  async get_temporary_link(path) {
    await this.retrieve_access_token();
    var input = {
      url: dropbox_base_url + "/2/files/get_temporary_link",
      token: this.token,
      body: {
        path: path
      }
    };
    var result = await do_http(input);
    return result;
  }

  async create_share_links(path) {
    await this.retrieve_access_token();
    var settings = {
      audience: "public",
      allow_download: true
    };
    var body = {
      path: path,
      settings: settings
    };
    var input = {
      url: dropbox_base_url + "/2/sharing/create_shared_link_with_settings",
      token: this.token,
      body: body
    };
    var result = await do_http(input);
    return result;
  }

  async list_shared_links() {
    await this.retrieve_access_token();
    var input = {
      url: dropbox_base_url + "/2/sharing/list_shared_links",
      token: this.token,
      body: {}
    };
    var result = await do_http(input);
    //    console.log(result);
    var links = result.links;
    while (result.has_more) {
      var input = {
        url: dropbox_base_url + "/2/sharing/list_shared_links",
        token: this.token,
        body: {
          cursor: result.cursor
        }
      };
      var result = await do_http(input);
      //      console.log(result);
      links = links.concat(result.links);
    }

    return links;
  }

  async make_create_request(path, title, description) {
    await this.retrieve_access_token();
    var body = {
      title: title,
      description: description,
      destination: path,
      open: true
    };
    var input = {
      url: dropbox_base_url + "/2/file_requests/create",
      token: this.token,
      body: body
    };
    var result = await do_http(input);
    return result;
  }

  async close_request(id) {
    await this.retrieve_access_token();
    var body = {
      id: id,
      open: false
    };
    var input = {
      url: dropbox_base_url + "/2/file_requests/update",
      token: this.token,
      body: body
    };
    var result = await do_http(input);
    //    console.log(result);

    var input = {
      url: dropbox_base_url + "/2/file_requests/delete",
      token: this.token,
      body: {
        ids: [id]
      }
    };
    var result = await do_http(input);
    return result;
  }

  async list_request() {
    await this.retrieve_access_token();
    var input = {
      url: dropbox_base_url + "/2/file_requests/list_v2",
      token: this.token,
      body: {}
    };
    var result = await do_http(input);
    //    console.log(result);
    var list = result.file_requests;
    while (result.has_more) {
      var input = {
        url: dropbox_base_url + "/2/file_requests/list_v2",
        token: this.token,
        body: {},
        cursor: result.cursor
      };
      var result = await do_http(input);
      //      console.log(result);

      list = list.concat(result.file_requests);
    }
    return list;
  }
}

// input: url, method, headers, qs, body, params, response_type, content_type, token, api_key
async function do_http(input) {
  const method = input.method ? input.method : "POST";
  const content_type = input.content_type ? input.content_type : "application/json";
  const response_type = input.response_type ? input.response_type : "json";

  const headers = new Headers();
  if (content_type != "multipart/form-data")
    headers.append("Content-Type", content_type);
  if (input.token)
    headers.append("Authorization", "Bearer " + input.token);
  if (input.api_key)
    headers.append("x-api-key", input.api_key);
  if (input.headers) {
    for (const key in input.headers)
      headers.append(key, input.headers[key]);
  }

  let body;
  if (content_type == "application/x-www-form-urlencoded") {
    body = new URLSearchParams(input.params);
  } else if (content_type == "multipart/form-data") {
    body = Object.entries(input.params).reduce((l, [k, v]) => { l.append(k, v); return l; }, new FormData());
  } else if (content_type == "application/json") {
    if (input.body)
      body = JSON.stringify(input.body);
  } else {
    body = input.body
  }

  const params = new URLSearchParams(input.qs);
  var params_str = params.toString();
  var postfix = (params_str == "") ? "" : ((input.url.indexOf('?') >= 0) ? ('&' + params_str) : ('?' + params_str));

  return fetch(input.url + postfix, {
    method: method,
    body: body,
    headers: headers
  })
    .then((response) => {
      if (!response.ok)
        throw new Error('status is not 200');

      if (response_type == "json")
        return response.json();
      else if (response_type == 'blob')
        return response.blob();
      else if (response_type == 'file') {
        const disposition = response.headers.get('Content-Disposition');
        let filename = "";
        if (disposition) {
          const parts = disposition.split(';').find(item => item.trim().startsWith("filename"));
          filename = parts.trim().split(/=(.+)/)[1];
          if (filename.toLowerCase().startsWith("utf-8''"))
            filename = decodeURIComponent(filename.replace(/utf-8''/i, ''));
          else
            filename = filename.replace(/['"]/g, '');
        }
        return response.blob()
          .then(blob => {
            return new File([blob], filename, { type: blob.type })
          });
      }
      else if (response_type == 'binary')
        return response.arrayBuffer();
      else // response_type == "text"
        return response.text();
    });
}

module.exports = Dropbox;
